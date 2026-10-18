#!/usr/bin/env bash
# Conservative production build for small VM/VPS instances; swap may still be required.
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_HEAP_MB="${UNZANET_BUILD_HEAP_MB:-1536}"
[[ "$BUILD_HEAP_MB" =~ ^[0-9]+$ ]] && (( BUILD_HEAP_MB >= 512 && BUILD_HEAP_MB <= 8192 )) || {
  printf 'UNZANET_BUILD_HEAP_MB harus antara 512 dan 8192 MiB.\n' >&2
  exit 1
}
export NG_BUILD_MAX_WORKERS="${NG_BUILD_MAX_WORKERS:-1}"
export NG_BUILD_PARALLEL_TS="${NG_BUILD_PARALLEL_TS:-0}"
printf '[UNZANET] Build frontend: worker=%s, parallel-ts=%s, V8 old-space=%s MiB (bukan batas total RAM).\n' \
  "$NG_BUILD_MAX_WORKERS" "$NG_BUILD_PARALLEL_TS" "$BUILD_HEAP_MB"
cd "$ROOT_DIR/frontend"
exec node --max-old-space-size="$BUILD_HEAP_MB" ./node_modules/@angular/cli/bin/ng.js \
  build --delete-output-path=false "$@"
