#!/usr/bin/env bash
# First-time VPS setup: Node, Nginx, systemd, Let's Encrypt for bac.codayroi.com
# Usage (as root, from repo):
#   sudo CERTBOT_EMAIL=you@example.com bash scripts/setup-vps.sh
set -euo pipefail

DOMAIN="${DOMAIN:-bac.codayroi.com}"
APP_USER="${APP_USER:-bacpq}"
DATA_DIR="${DATA_DIR:-/var/lib/bacpq}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Chạy bằng root: sudo bash scripts/setup-vps.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Repo: ${APP_DIR}"
echo "==> Domain: ${DOMAIN}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx git curl ca-certificates

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

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp "${APP_DIR}/deploy/env.example" "${APP_DIR}/.env"
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
  echo "Đã tạo ${APP_DIR}/.env — điền VAPID_* rồi chạy lại deploy:"
  echo "  sudo -u ${APP_USER} npx --yes web-push generate-vapid-keys"
  echo "  nano ${APP_DIR}/.env"
  echo "  sudo bash ${APP_DIR}/scripts/deploy.sh"
  echo "  sudo bash ${APP_DIR}/scripts/setup-vps.sh   # lần 2: certbot + enable service"
fi

# Keep DATA_DIR in .env in sync
if grep -q '^DATA_DIR=' "${APP_DIR}/.env"; then
  sed -i "s|^DATA_DIR=.*|DATA_DIR=${DATA_DIR}|" "${APP_DIR}/.env"
else
  echo "DATA_DIR=${DATA_DIR}" >> "${APP_DIR}/.env"
fi

NGINX_SRC="${APP_DIR}/deploy/nginx-${DOMAIN}.conf"
NGINX_DST="/etc/nginx/sites-available/${DOMAIN}"
if [[ ! -f "${NGINX_SRC}" ]]; then
  echo "Thiếu ${NGINX_SRC}" >&2
  exit 1
fi
cp "${NGINX_SRC}" "${NGINX_DST}"
ln -sfn "${NGINX_DST}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

UNIT_TMP="$(mktemp)"
sed "s|__APP_DIR__|${APP_DIR}|g" "${APP_DIR}/deploy/bacpq.service" > "${UNIT_TMP}"
install -m 644 "${UNIT_TMP}" /etc/systemd/system/bacpq.service
rm -f "${UNIT_TMP}"
systemctl daemon-reload

if grep -qE '^VAPID_PUBLIC_KEY=.+' "${APP_DIR}/.env" && grep -qE '^VAPID_PRIVATE_KEY=.+' "${APP_DIR}/.env"; then
  bash "${APP_DIR}/scripts/deploy.sh"
  systemctl enable bacpq
else
  echo "==> Bỏ qua start app: chưa điền VAPID trong ${APP_DIR}/.env"
fi

if [[ -z "${CERTBOT_EMAIL}" ]]; then
  CERTBOT_EMAIL="$(grep -E '^VAPID_SUBJECT=' "${APP_DIR}/.env" | head -1 | sed 's/^VAPID_SUBJECT=mailto://; s/^VAPID_SUBJECT=//')"
fi

if [[ -n "${CERTBOT_EMAIL}" && "${CERTBOT_EMAIL}" != "you@example.com" ]]; then
  echo "==> Certbot ${DOMAIN} (${CERTBOT_EMAIL})"
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${CERTBOT_EMAIL}" --redirect || {
    echo "Certbot chưa xong. Kiểm tra DNS A ${DOMAIN} → IP VPS, rồi:" >&2
    echo "  sudo certbot --nginx -d ${DOMAIN} -m ${CERTBOT_EMAIL}" >&2
  }
else
  echo "==> Bỏ qua Certbot (set CERTBOT_EMAIL=you@domain.com)"
  echo "    sudo CERTBOT_EMAIL=you@domain.com bash scripts/setup-vps.sh"
fi

echo "==> Setup xong. Health: curl -sS http://127.0.0.1:8787/api/health"
echo "    Public: https://${DOMAIN}/api/health"
