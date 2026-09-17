#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
SERVICE_NAME="${SERVICE_NAME:-unzanet-backend}"

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

log "Install dependency backend"
install_node_modules "$BACKEND_DIR" "Backend"

log "Generate Prisma Client"
cd "$BACKEND_DIR"
npm run prisma:generate

log "Stop backend sementara"
sudo systemctl stop "$SERVICE_NAME" || true

log "Cek dan jalankan migrasi SQL yang belum pernah dijalankan"
cd "$ROOT_DIR"
npm run migrate:updates

log "Build backend"
cd "$BACKEND_DIR"
npm run build

log "Reload dan start backend"
sudo systemctl daemon-reload
sudo systemctl start "$SERVICE_NAME"

log "Install dependency frontend"
install_node_modules "$FRONTEND_DIR" "Frontend"

log "Build frontend"
cd "$FRONTEND_DIR"
npm run build

log "Status backend"
sudo systemctl status "$SERVICE_NAME" --no-pager

log "Selesai"
