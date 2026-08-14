#!/usr/bin/env bash
# Update app on the VPS: pull, build, restart systemd.
# Runtime env: GitHub Actions secrets → /etc/bacpq.env (không dùng .env trong repo).
# Usage:
#   sudo bash scripts/deploy.sh
#   sudo bash scripts/deploy.sh --no-pull
set -euo pipefail

APP_USER="${APP_USER:-bacpq}"
RUNTIME_ENV="${RUNTIME_ENV:-/etc/bacpq.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
NO_PULL=0
[[ "${1:-}" == "--no-pull" ]] && NO_PULL=1

run_as_app() {
  if [[ "$(id -un)" == "${APP_USER}" ]]; then
    "$@"
  elif [[ "${EUID}" -eq 0 ]]; then
    sudo -u "${APP_USER}" -H -- "$@"
  else
    echo "Chạy bằng user ${APP_USER} hoặc root." >&2
    exit 1
  fi
}

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

cd "${APP_DIR}"

if write_runtime_env; then
  echo "==> Ghi ${RUNTIME_ENV} từ env (GitHub Actions)"
elif [[ -f "${RUNTIME_ENV}" ]]; then
  echo "==> Giữ ${RUNTIME_ENV}"
else
  echo "Thiếu VAPID_* — thêm Secrets trên GitHub (Actions), rồi push / Run workflow." >&2
  echo "  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT" >&2
  exit 1
fi

if [[ "${NO_PULL}" -eq 0 && -d .git ]]; then
  echo "==> git pull"
  run_as_app git -C "${APP_DIR}" pull --ff-only
fi

echo "==> npm ci + build"
run_as_app bash -lc "cd '${APP_DIR}' && npm ci && npm run build"

if [[ -f /etc/systemd/system/bacpq.service ]]; then
  echo "==> systemctl restart bacpq"
  if [[ "${EUID}" -eq 0 ]]; then
    systemctl daemon-reload
    systemctl restart bacpq
    systemctl --no-pager --full status bacpq || true
  else
    sudo systemctl daemon-reload
    sudo systemctl restart bacpq
    sudo systemctl --no-pager --full status bacpq || true
  fi
else
  echo "==> Chưa có systemd unit — chạy: sudo bash scripts/setup-vps-webinoly.sh"
fi

PORT_CHECK="$(app_port)"
echo "==> health"
sleep 1
curl -fsS "http://127.0.0.1:${PORT_CHECK}/api/health" || {
  echo "Health check fail. Xem: journalctl -u bacpq -n 80 --no-pager" >&2
  exit 1
}
echo
echo "==> Deploy xong: https://bac.codayroi.com"
