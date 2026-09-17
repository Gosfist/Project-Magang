#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BOTWA_DIR="$ROOT_DIR/bot_whatsapp"
SERVICE_NAME="${SERVICE_NAME:-unzanet-backend}"
BOTWA_SERVICE="${BOTWA_SERVICE:-unzanet-botwa}"
MODE="${1:-all}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

install_node_modules() {
  local app_dir="$1"
  local app_name="$2"

  cd "$app_dir"
  if npm ci; then
    return
  fi

  log "$app_name package-lock tidak sinkron, mencoba npm install"
  npm install
}

cd "$ROOT_DIR"

log "Ambil update terbaru dari Git"
git pull --ff-only

if [[ "$MODE" != "all" && "$MODE" != "be" && "$MODE" != "fe" && "$MODE" != "bot" ]]; then
  printf 'Mode tidak dikenal: %s\nGunakan: npm run update, npm run updatebe, npm run updatefe, atau npm run updatebot\n' "$MODE"
  exit 1
fi

if [[ "$MODE" == "all" || "$MODE" == "be" ]]; then
  log "Install dependency backend"
  install_node_modules "$BACKEND_DIR" "Backend"

  log "Generate Prisma Client"
  cd "$BACKEND_DIR"
  npm run prisma:generate

  log "Stop backend sementara"
  sudo systemctl stop "$SERVICE_NAME" || true

  log "Build backend"
  npm run build

  log "Reload dan start backend"
  sudo systemctl daemon-reload
  sudo systemctl start "$SERVICE_NAME"
fi

if [[ "$MODE" == "all" || "$MODE" == "fe" ]]; then
  log "Install dependency frontend"
  install_node_modules "$FRONTEND_DIR" "Frontend"

  log "Build frontend"
  cd "$FRONTEND_DIR"
  npm run build
fi

if [[ "$MODE" == "all" || "$MODE" == "bot" ]]; then
  log "Install dependency bot WhatsApp"
  install_node_modules "$BOTWA_DIR" "Bot WhatsApp"

  log "Restart bot WhatsApp"
  sudo systemctl daemon-reload
  sudo systemctl restart "$BOTWA_SERVICE"
fi

log "Cek dan jalankan migrasi SQL yang belum pernah dijalankan"
cd "$ROOT_DIR"
npm run migrate:updates

log "Status backend"
sudo systemctl status "$SERVICE_NAME" --no-pager || true

if systemctl is-enabled "$BOTWA_SERVICE" &>/dev/null; then
  log "Status bot WhatsApp"
  sudo systemctl status "$BOTWA_SERVICE" --no-pager || true
fi

log "Selesai"

