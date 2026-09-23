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
  UPLOADS_DIR="${UPLOADS_DIR:-$ROOT_DIR/uploads}"
  BACKEND_USER="$(systemctl show -p User --value "$SERVICE_NAME" 2>/dev/null || true)"
  BACKEND_USER="${BACKEND_USER:-$(id -un)}"
  BACKEND_GROUP="$(id -gn "$BACKEND_USER")"

  log "Siapkan folder upload untuk backend"
  sudo install -d -o "$BACKEND_USER" -g "$BACKEND_GROUP" -m 0750 \
    "$UPLOADS_DIR" \
    "$UPLOADS_DIR/ktp" \
    "$UPLOADS_DIR/profile" \
    "$UPLOADS_DIR/instalasi" \
    "$UPLOADS_DIR/bukti-setoran"
  sudo chown -R "$BACKEND_USER:$BACKEND_GROUP" "$UPLOADS_DIR"

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

  log "Sinkronisasi environment bot WhatsApp"
  if [[ ! -f "$BOTWA_DIR/.env" ]] && [[ -f "$BOTWA_DIR/.env.example" ]]; then
    cp "$BOTWA_DIR/.env.example" "$BOTWA_DIR/.env"
  fi

  if [[ -f "$BACKEND_DIR/.env" ]] && [[ -f "$BOTWA_DIR/.env" ]]; then
    DB_URL=$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | head -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
    if [[ -n "$DB_URL" ]]; then
      if grep -q '^DATABASE_URL=' "$BOTWA_DIR/.env"; then
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$DB_URL\"|" "$BOTWA_DIR/.env"
      else
        echo "DATABASE_URL=\"$DB_URL\"" >> "$BOTWA_DIR/.env"
      fi
    fi
  fi

  log "Setup dan restart bot WhatsApp"
  if [[ -f "$BOTWA_DIR/unzanet-botwa.service" ]]; then
    sudo cp "$BOTWA_DIR/unzanet-botwa.service" /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable "$BOTWA_SERVICE" || true
  fi
  BOTWA_USER="$(systemctl show -p User --value "$BOTWA_SERVICE" 2>/dev/null || true)"
  BOTWA_USER="${BOTWA_USER:-$(id -un)}"
  BOTWA_GROUP="$(id -gn "$BOTWA_USER")"
  sudo install -d -o "$BOTWA_USER" -g "$BOTWA_GROUP" -m 0750 "$BOTWA_DIR/auth_info"
  sudo chown -R "$BOTWA_USER:$BOTWA_GROUP" "$BOTWA_DIR/auth_info"
  sudo systemctl daemon-reload
  sudo systemctl restart "$BOTWA_SERVICE" || true
fi

log "Cek dan jalankan migrasi SQL yang belum pernah dijalankan"
cd "$ROOT_DIR"
npm run migrate:updates

if [[ "$MODE" == "all" || "$MODE" == "be" ]]; then
  log "Status backend"
  sudo systemctl status "$SERVICE_NAME" --no-pager || true
fi

if [[ "$MODE" == "all" || "$MODE" == "bot" ]]; then
  log "Status bot WhatsApp"
  sudo systemctl status "$BOTWA_SERVICE" --no-pager || true
fi

log "Selesai"
