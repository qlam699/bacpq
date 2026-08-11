#!/usr/bin/env bash
# Update app on the VPS: pull, build, restart systemd.
# Usage:
#   sudo bash scripts/deploy.sh
#   sudo bash scripts/deploy.sh --no-pull
set -euo pipefail

APP_USER="${APP_USER:-bacpq}"
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

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "Thiếu ${APP_DIR}/.env — copy từ deploy/env.example và điền VAPID_*" >&2
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
    systemctl restart bacpq
    systemctl --no-pager --full status bacpq || true
  else
    sudo systemctl restart bacpq
    sudo systemctl --no-pager --full status bacpq || true
  fi
else
  echo "==> Chưa có systemd unit — chạy: sudo bash scripts/setup-vps.sh"
fi

echo "==> health"
sleep 1
curl -fsS http://127.0.0.1:8787/api/health || {
  echo "Health check fail. Xem: journalctl -u bacpq -n 80 --no-pager" >&2
  exit 1
}
echo
echo "==> Deploy xong: https://bac.codayroi.com"
