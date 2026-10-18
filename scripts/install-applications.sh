#!/usr/bin/env bash
# Frontend is built on the developer's machine; only backend is compiled here.
set -Eeuo pipefail

install_applications() {
  local folder
  python3 "$INSTALL_ROOT/scripts/frontend-prebuilt.py" --check
  for folder in backend bot_whatsapp; do
    printf '\n[UNZANET] Dependency %s\n' "$folder"
    (cd "$INSTALL_ROOT/$folder" && umask 022 && npm ci)
  done
  printf '\n[UNZANET] Generate Prisma tanpa koneksi database\n'
  (cd "$INSTALL_ROOT/backend" && umask 022 && npm run prisma:generate)
  (cd "$INSTALL_ROOT" && npm run database:check)
  printf '\n[UNZANET] Build backend\n'
  (cd "$INSTALL_ROOT/backend" && umask 022 && npm run build)
  python3 "$INSTALL_ROOT/scripts/frontend-prebuilt.py"
  [[ -f "$INSTALL_ROOT/frontend/dist/frontend/browser/index.html" ]]
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  [[ $# == 0 ]] || { printf 'Jalankan melalui npm run install.\n' >&2; exit 1; }
  INSTALL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  install_applications
fi
