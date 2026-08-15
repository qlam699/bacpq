#!/usr/bin/env bash
# First-time VPS setup khi Nginx/SSL đã do Webinoly quản lý.
# Không apt-install nginx/certbot, không ghi đè /etc/nginx/sites-available.
#
# Usage (as root, from repo):
#   sudo bash scripts/setup-vps-webinoly.sh
#   sudo SKIP_SSL=1 bash scripts/setup-vps-webinoly.sh   # chưa trỏ DNS
#   sudo SKIP_SITE=1 bash scripts/setup-vps-webinoly.sh  # chỉ Node + systemd
set -euo pipefail

DOMAIN="${DOMAIN:-bac.codayroi.com}"
APP_USER="${APP_USER:-bacpq}"
DATA_DIR="${DATA_DIR:-/var/lib/bacpq}"
PORT="${PORT:-8787}"
SKIP_SITE="${SKIP_SITE:-0}"
SKIP_SSL="${SKIP_SSL:-0}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Chạy bằng root: sudo bash scripts/setup-vps-webinoly.sh" >&2
  exit 1
fi

if ! command -v site >/dev/null 2>&1; then
  echo "Không thấy lệnh Webinoly \`site\`. Cài Webinoly trước, rồi chạy lại script này." >&2
  echo "  https://webinoly.com/" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SITE_NGINX="/etc/nginx/sites-available/${DOMAIN}"

echo "==> Repo: ${APP_DIR}"
echo "==> Domain: ${DOMAIN}"
echo "==> Proxy: 127.0.0.1:${PORT} (Webinoly, không đụng nginx conf tay)"

export DEBIAN_FRONTEND=noninteractive
# Ondrej PHP / Webinoly PPA đôi khi đổi Label → cần --allow-releaseinfo-change
apt-get update -y --allow-releaseinfo-change
apt-get install -y git curl ca-certificates

if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 20)'; then
  echo "==> Cài Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "==> Node $(node -v) / npm $(npm -v)"

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  adduser --system --group --home "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

mkdir -p "${DATA_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${DATA_DIR}"

UNIT_TMP="$(mktemp)"
sed "s|__APP_DIR__|${APP_DIR}|g" "${APP_DIR}/deploy/bacpq.service" > "${UNIT_TMP}"
install -m 644 "${UNIT_TMP}" /etc/systemd/system/bacpq.service
rm -f "${UNIT_TMP}"
systemctl daemon-reload
systemctl enable bacpq

if [[ -f /etc/bacpq.env ]]; then
  bash "${APP_DIR}/scripts/deploy.sh"
else
  echo "==> Chưa có /etc/bacpq.env — env lấy từ GitHub Actions Secrets."
  echo "    Thêm VAPID_* rồi push main (hoặc Run workflow) để deploy lần đầu."
fi

if [[ "${SKIP_SITE}" != "1" ]]; then
  if [[ -e "${SITE_NGINX}" ]]; then
    echo "==> Site ${DOMAIN} đã có (Webinoly). Không tạo lại / không ghi đè nginx."
    site "${DOMAIN}" -info || true
  else
    # Webinoly: port-only = localhost:PORT (đừng dùng http://127.0.0.1 — bản cũ báo "valid host and port")
    echo "==> Tạo reverse proxy Webinoly → localhost:${PORT}"
    if ! site "${DOMAIN}" -proxy="${PORT}"; then
      echo "Cảnh báo: tạo site proxy thất bại. Thử tay:" >&2
      echo "  sudo site ${DOMAIN} -proxy=${PORT}" >&2
      echo "  sudo site ${DOMAIN} -ssl=on" >&2
    fi
  fi

  if [[ "${SKIP_SSL}" != "1" && -e "${SITE_NGINX}" ]]; then
    echo "==> SSL Let's Encrypt (Webinoly)"
    if site "${DOMAIN}" -ssl=on; then
      echo "==> SSL OK"
    else
      echo "SSL chưa xong. Kiểm tra DNS A ${DOMAIN} → IP VPS, rồi:" >&2
      echo "  sudo site ${DOMAIN} -ssl=on" >&2
    fi
  elif [[ "${SKIP_SSL}" == "1" ]]; then
    echo "==> Bỏ qua SSL (SKIP_SSL=1). Khi DNS sẵn sàng:"
    echo "    sudo site ${DOMAIN} -ssl=on"
  fi
else
  echo "==> Bỏ qua site Webinoly (SKIP_SITE=1). Tự tạo:"
  echo "    sudo site ${DOMAIN} -proxy=${PORT}"
  echo "    sudo site ${DOMAIN} -ssl=on"
fi

echo
echo "==> Setup Webinoly xong."
echo "    Local:  curl -sS http://127.0.0.1:${PORT}/api/health"
echo "    Public: https://${DOMAIN}/api/health"
echo "    Log:    journalctl -u bacpq -f"
echo "    Deploy: sudo bash ${APP_DIR}/scripts/deploy.sh"
echo
echo "SSE: proxy Webinoly timeout ~300s — client sẽ reconnect. Nếu stream bị đơ,"
echo "không sửa sites-available tay; thêm location /api/ (proxy_buffering off) qua"
echo "custom include Webinoly, rồi: sudo nginx -t && sudo systemctl reload nginx"
