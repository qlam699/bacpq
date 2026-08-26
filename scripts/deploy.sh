#!/usr/bin/env bash
# Apply release artifact on the VPS: wipe APP_DIR, extract, write env, restart systemd.
# Runtime env: GitHub Actions secrets → /etc/bacpq.env (không dùng .env trong repo).
# Usage:
#   sudo APP_DIR=/var/www/bacpq bash scripts/deploy.sh --release /tmp/bacpq-release.tar.gz
#   sudo bash scripts/deploy.sh   # chỉ ghi env (nếu có) + restart khi đã có release
set -euo pipefail

APP_USER="${APP_USER:-bacpq}"
RUNTIME_ENV="${RUNTIME_ENV:-/etc/bacpq.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_TAR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release)
      RELEASE_TAR="${2:?--release cần đường dẫn tarball}"
      shift 2
      ;;
    --no-pull)
      # Giữ tương thích lời gọi cũ; không còn git pull
      shift
      ;;
    *)
      echo "Usage: $0 [--release /path/to/bacpq-release.tar.gz]" >&2
      exit 1
      ;;
  esac
done

if [[ -n "${RELEASE_TAR}" ]]; then
  APP_DIR="${APP_DIR:-/var/www/bacpq}"
else
  APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
fi

write_runtime_env() {
  if [[ -z "${VAPID_PUBLIC_KEY:-}" || -z "${VAPID_PRIVATE_KEY:-}" ]]; then
    return 1
  fi
  umask 077
  {
    printf 'PORT=%s\n' "${PORT:-8787}"
    printf 'VAPID_PUBLIC_KEY=%s\n' "${VAPID_PUBLIC_KEY}"
    printf 'VAPID_PRIVATE_KEY=%s\n' "${VAPID_PRIVATE_KEY}"
    printf 'VAPID_SUBJECT=%s\n' "${VAPID_SUBJECT:-mailto:you@example.com}"
    printf 'DATA_DIR=%s\n' "${DATA_DIR:-/var/lib/bacpq}"
    printf 'POLL_MS=%s\n' "${POLL_MS:-2000}"
  } > "${RUNTIME_ENV}"
  chmod 600 "${RUNTIME_ENV}"
}

app_port() {
  if [[ -f "${RUNTIME_ENV}" ]]; then
    local p
    p="$(grep -E '^PORT=' "${RUNTIME_ENV}" | head -1 | cut -d= -f2- || true)"
    if [[ -n "${p}" ]]; then
      echo "${p}"
      return
    fi
  fi
  echo "${PORT:-8787}"
}

install_unit() {
  local unit_src="${APP_DIR}/deploy/bacpq.service"
  if [[ ! -f "${unit_src}" ]]; then
    echo "Thiếu ${unit_src}" >&2
    return 1
  fi
  local unit_tmp
  unit_tmp="$(mktemp)"
  sed "s|__APP_DIR__|${APP_DIR}|g" "${unit_src}" > "${unit_tmp}"
  install -m 644 "${unit_tmp}" /etc/systemd/system/bacpq.service
  rm -f "${unit_tmp}"
  systemctl daemon-reload
  systemctl enable bacpq
}

restart_service() {
  if [[ ! -f /etc/systemd/system/bacpq.service ]]; then
    echo "==> Chưa có systemd unit — chạy: sudo bash scripts/setup-vps-webinoly.sh" >&2
    return 1
  fi
  echo "==> systemctl restart bacpq"
  systemctl daemon-reload
  systemctl restart bacpq
  systemctl --no-pager --full status bacpq || true
}

apply_release() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Cần root để --release (wipe ${APP_DIR})." >&2
    exit 1
  fi
  if [[ ! -f "${RELEASE_TAR}" ]]; then
    echo "Không thấy tarball: ${RELEASE_TAR}" >&2
    exit 1
  fi

  if [[ -f /etc/systemd/system/bacpq.service ]]; then
    echo "==> systemctl stop bacpq"
    systemctl stop bacpq || true
  fi

  echo "==> Xóa sạch ${APP_DIR} (bỏ bản git clone / release cũ)"
  rm -rf "${APP_DIR}"
  mkdir -p "${APP_DIR}"
  echo "==> Giải nén ${RELEASE_TAR} → ${APP_DIR}"
  tar -xzf "${RELEASE_TAR}" -C "${APP_DIR}"

  if id -u "${APP_USER}" >/dev/null 2>&1; then
    chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  fi

  echo "==> Cài / cập nhật systemd unit"
  install_unit
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Chạy bằng root: sudo bash scripts/deploy.sh ..." >&2
  exit 1
fi

if [[ -n "${RELEASE_TAR}" ]]; then
  apply_release
fi

if write_runtime_env; then
  echo "==> Ghi ${RUNTIME_ENV} từ env (GitHub Actions)"
elif [[ -f "${RUNTIME_ENV}" ]]; then
  echo "==> Giữ ${RUNTIME_ENV}"
else
  echo "Thiếu VAPID_* — thêm Secrets trên GitHub (Actions), rồi push / Run workflow." >&2
  echo "  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT" >&2
  exit 1
fi

if [[ ! -f "${APP_DIR}/server/dist/index.js" ]]; then
  echo "Thiếu ${APP_DIR}/server/dist/index.js — cần deploy bằng --release từ GitHub Actions artifact." >&2
  exit 1
fi

restart_service

PORT_CHECK="$(app_port)"
echo "==> health"
sleep 1
curl -fsS "http://127.0.0.1:${PORT_CHECK}/api/health" || {
  echo "Health check fail. Xem: journalctl -u bacpq -n 80 --no-pager" >&2
  exit 1
}
echo
echo "==> Deploy xong: https://bac.codayroi.com"
