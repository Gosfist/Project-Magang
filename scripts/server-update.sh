#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BOTWA_DIR="$ROOT_DIR/bot_whatsapp"
SERVICE_NAME="${SERVICE_NAME:-unzanet-backend}"
BOTWA_SERVICE="${BOTWA_SERVICE:-unzanet-botwa}"
MODE="${1:-all}"

if [[ "$EUID" -ne 0 ]]; then
  exec sudo bash "$ROOT_DIR/scripts/server-update.sh" "$@"
fi

if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" != 26 ]]; then
  printf 'ERROR: Server update memerlukan Node.js 26. Jalankan installer NodeSource 26 lalu ulangi.\n' >&2
  exit 1
fi

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

reload_updater_if_updated() {
  local previous_revision="$1" current_revision="$2"
  if [[ "$previous_revision" != "$current_revision" ]]; then
    log "Kode berubah ke ${current_revision:0:7}; memuat ulang updater sebelum mengubah aplikasi"
    # The running Bash process may still read the old inode after git replaces
    # this file. Re-exec before any build/service change, preserving update mode.
    exec /bin/bash "$ROOT_DIR/scripts/server-update.sh" "$MODE"
  fi
}

if [[ "$MODE" != "all" && "$MODE" != "be" && "$MODE" != "fe" && "$MODE" != "bot" ]]; then
  printf 'Mode tidak dikenal: %s\nGunakan: npm run update, npm run updatebe, npm run updatefe, atau npm run updatebot\n' "$MODE"
  exit 1
fi

cd "$ROOT_DIR"

log "Ambil update terbaru dari Git"
REPO_OWNER="$(stat -c '%U' "$ROOT_DIR/.git")"
PREVIOUS_REVISION="$(runuser -u "$REPO_OWNER" -- git -C "$ROOT_DIR" rev-parse HEAD)"
runuser -u "$REPO_OWNER" -- git -C "$ROOT_DIR" pull --ff-only
CURRENT_REVISION="$(runuser -u "$REPO_OWNER" -- git -C "$ROOT_DIR" rev-parse HEAD)"
reload_updater_if_updated "$PREVIOUS_REVISION" "$CURRENT_REVISION"

if [[ "$MODE" == all || "$MODE" == fe ]]; then
  python3 "$ROOT_DIR/scripts/frontend-prebuilt.py" --check
fi

if [[ "$MODE" == "all" || "$MODE" == "be" ]]; then
  UPLOADS_DIR="${UPLOADS_DIR:-$ROOT_DIR/uploads}"
  BACKEND_USER="$(systemctl show -p User --value "$SERVICE_NAME" 2>/dev/null || true)"
  BACKEND_USER="${BACKEND_USER:-$(id -un)}"
  BACKEND_GROUP="$(systemctl show -p Group --value "$SERVICE_NAME" 2>/dev/null || true)"
  BACKEND_GROUP="${BACKEND_GROUP:-$(id -gn "$BACKEND_USER")}"

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

  log "Periksa kolom dan index database tanpa mengubah skema"
  node "$ROOT_DIR/scripts/check-backend-schema.mjs"

  log "Build backend ke staging; dist lama dipertahankan jika build gagal"
  node "$ROOT_DIR/scripts/build-backend.mjs"

  if systemctl cat freeradius.service >/dev/null 2>&1; then
    log "Siapkan penerapan client NAS SQL tanpa hak sudo pada web"
    bash "$ROOT_DIR/scripts/setup-radius-refresh.sh"
  fi

  if [[ -f /etc/accel-ppp.conf && -f /etc/unzanet-public/sstp-ca.crt ]]; then
    sudo bash "$ROOT_DIR/scripts/setup-vpn-sync.sh"
  fi

  log "Reload dan start backend"
  sudo systemctl daemon-reload
  sudo systemctl restart "$SERVICE_NAME"
  sleep 2
  if ! sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    log "Backend gagal menyala. Periksa: sudo journalctl -u $SERVICE_NAME -n 80 --no-pager -o cat"
    exit 1
  fi
fi

if [[ "$MODE" == "all" || "$MODE" == "fe" ]]; then
  log "Pasang frontend hasil build laptop"
  python3 "$ROOT_DIR/scripts/frontend-prebuilt.py"
fi

if [[ "$MODE" == "all" || "$MODE" == "bot" ]]; then
  log "Build bot WhatsApp Go + whatsmeow"
  bash "$ROOT_DIR/scripts/build-bot.sh"

  BOTWA_USER="$(systemctl show -p User --value "$BOTWA_SERVICE" 2>/dev/null || true)"
  BOTWA_USER="${BOTWA_USER:-unzanet}"
  BOTWA_GROUP="$(systemctl show -p Group --value "$BOTWA_SERVICE" 2>/dev/null || true)"
  BOTWA_GROUP="${BOTWA_GROUP:-$(id -gn "$BOTWA_USER")}"
  log "Sinkronisasi database/API key dan migrasi service bot ke executable Go"
  python3 "$ROOT_DIR/scripts/configure-bot.py" --root "$ROOT_DIR" --user "$BOTWA_USER" --group "$BOTWA_GROUP" --service-name "$BOTWA_SERVICE"
  chown "$BOTWA_USER:$BOTWA_GROUP" "$BOTWA_DIR/.env"
  chmod 0600 "$BOTWA_DIR/.env"
  install -d -o "$BOTWA_USER" -g "$BOTWA_GROUP" -m 0700 "$BOTWA_DIR/data"
  # Existing Baileys auth_info is preserved; whatsmeow requires a new QR scan.
  systemctl daemon-reload
  systemctl enable "$BOTWA_SERVICE"
  systemctl restart "$BOTWA_SERVICE"
  sleep 2
  systemctl is-active --quiet "$BOTWA_SERVICE"
  BOTWA_PORT="$(python3 - "$ROOT_DIR" <<'PY'
import importlib.util, pathlib, sys
root = pathlib.Path(sys.argv[1])
spec = importlib.util.spec_from_file_location('bot_config', root / 'scripts/configure-bot.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
port = module.read_env(root / 'bot_whatsapp/.env').get('PORT', '3002')
if not port.isdecimal() or not 1 <= int(port) <= 65535:
    raise SystemExit('PORT bot tidak valid.')
print(port)
PY
)"
  curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$BOTWA_PORT/api/wa/health"
  log "Bersihkan dependency Node.js bot lama setelah health Go berhasil"
  python3 "$ROOT_DIR/scripts/cleanup-bot-node.py" --root "$ROOT_DIR"
fi

if [[ "$MODE" == "all" || "$MODE" == "be" ]]; then
  log "Status backend"
  sudo systemctl status "$SERVICE_NAME" --no-pager || true
fi

if [[ "$MODE" == "all" || "$MODE" == "bot" ]]; then
  log "Status bot WhatsApp"
  sudo systemctl status "$BOTWA_SERVICE" --no-pager || true
fi

log "Selesai"
