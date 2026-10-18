#!/usr/bin/env bash
# Installation builds run serially in one bounded cgroup, with application services paused.
set -Eeuo pipefail

BUILD_ACTIVE_SERVICES=()
BUILD_SERVICE_ORDER=(mysql.service apache2.service freeradius.service unzanet-backend.service unzanet-botwa.service unzanet-radius-nas-refresh.service unzanet-radius-nas-refresh.timer)
BUILD_UNIT=''

build_limits() {
  local total="$1" available="$2" maximum high heap
  [[ "$total" =~ ^[0-9]+$ && "$available" =~ ^[0-9]+$ ]] || return 1
  maximum=$((total - 512))
  (( maximum <= 1400 )) || maximum=1400
  (( maximum <= available - 256 )) || maximum=$((available - 256))
  if (( maximum < 1024 )); then
    printf 'RAM tersedia terlalu kecil. Sisakan minimal 1280 MiB available setelah layanan dihentikan; kurangi proses lain atau build di mesin lain.\n' >&2
    return 1
  fi
  high=$((maximum * 80 / 100))
  heap=$((maximum * 70 / 100))
  printf '%s %s %s\n' "$maximum" "$high" "$heap"
}

build_pause_services() {
  local service index
  # Snapshot every original state before the first stop, including failure during stop.
  for service in "${BUILD_SERVICE_ORDER[@]}"; do
    if systemctl is-active --quiet "$service"; then BUILD_ACTIVE_SERVICES+=("$service"); fi
  done
  for (( index=${#BUILD_ACTIVE_SERVICES[@]}-1; index>=0; index-- )); do
    service="${BUILD_ACTIVE_SERVICES[index]}"
    printf '[UNZANET] Hentikan sementara %s\n' "$service"
    systemctl stop "$service" || return 1
  done
}

build_resume_services() {
  local service failed=0
  # Database first, applications after it, refresh worker/timer last.
  for service in "${BUILD_ACTIVE_SERVICES[@]}"; do
    printf '[UNZANET] Pulihkan %s\n' "$service"
    if ! systemctl start "$service"; then
      printf '[UNZANET] Gagal memulihkan %s; periksa systemctl status.\n' "$service" >&2
      failed=1
    fi
  done
  BUILD_ACTIVE_SERVICES=()
  return "$failed"
}

build_cleanup() {
  local result="$1"
  trap - EXIT INT TERM HUP
  # Stop the entire build group before starting services after interruption.
  if [[ -n "$BUILD_UNIT" ]]; then systemctl stop "$BUILD_UNIT" >/dev/null 2>&1 || true; fi
  if ! build_resume_services && (( result == 0 )); then result=1; fi
  exit "$result"
}

build_install_worker() {
  local folder
  for folder in backend frontend bot_whatsapp; do
    printf '\n[UNZANET] Dependency %s\n' "$folder"
    (cd "$BUILD_ROOT/$folder" && umask 022 && npm ci)
  done
  printf '\n[UNZANET] Generate Prisma tanpa koneksi database\n'
  (cd "$BUILD_ROOT/backend" && umask 022 && npm run prisma:generate)
  (cd "$BUILD_ROOT" && npm run database:check)
  printf '\n[UNZANET] Build backend\n'
  (cd "$BUILD_ROOT/backend" && umask 022 && npm run build)
  printf '\n[UNZANET] Build frontend\n'
  (umask 022 && bash "$BUILD_ROOT/scripts/build-frontend.sh")
  [[ -f "$BUILD_ROOT/frontend/dist/frontend/browser/index.html" ]]
}

build_run_bounded() {
  local maximum="$1" high="$2" heap="$3"
  systemd-run --quiet --wait --pipe --collect --service-type=exec \
    --unit="$BUILD_UNIT" --working-directory="$BUILD_ROOT" \
    --property=MemoryAccounting=yes --property="MemoryHigh=${high}M" \
    --property="MemoryMax=${maximum}M" --property=MemorySwapMax=4G \
    --property=CPUQuota=100% --property=OOMPolicy=kill \
    /usr/bin/env "HOME=${HOME:-/root}" "PATH=$PATH" \
    "NODE_OPTIONS=${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=$heap" \
    "UNZANET_BUILD_HEAP_MB=$heap" NG_BUILD_MAX_WORKERS=1 NG_BUILD_PARALLEL_TS=0 GOMAXPROCS=1 \
    /bin/bash "$BUILD_ROOT/scripts/build-install-phase.sh" --worker
}

build_main() {
  BUILD_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [[ "${1:-}" == --worker && $# == 1 ]]; then build_install_worker; return; fi
  [[ $# == 0 ]] || { printf 'Jalankan melalui npm run install.\n' >&2; return 1; }
  [[ "$EUID" == 0 && "$(uname -s)" == Linux && -d /run/systemd/system ]] || {
    printf 'Tahap build installer memerlukan root dan systemd Ubuntu.\n' >&2; return 1;
  }
  [[ -f /sys/fs/cgroup/cgroup.controllers ]] && grep -qw memory /sys/fs/cgroup/cgroup.controllers || {
    printf 'Controller memory cgroup v2 tidak tersedia; build tidak dijalankan tanpa batas RAM.\n' >&2; return 1;
  }
  exec 8>/run/lock/unzanet-build.lock
  flock -n 8 || { printf 'Build lain masih berjalan.\n' >&2; return 1; }
  trap 'build_cleanup "$?"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 129' HUP
  printf '\n[UNZANET] Build berurutan; web, database dan RADIUS dihentikan sementara. SSH dan jaringan tetap aktif.\n'
  systemctl daemon-reload
  build_pause_services
  local total available maximum high heap swap
  total="$(awk '/^MemTotal:/ {print int($2/1024)}' /proc/meminfo)"
  available="$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)"
  swap="$(awk '/^SwapTotal:/ {print int($2/1024)}' /proc/meminfo)"
  read -r maximum high heap < <(build_limits "$total" "$available")
  printf '[UNZANET] Batas RAM seluruh proses build %s MiB; high %s MiB; heap %s MiB; swap sistem %s MiB.\n' "$maximum" "$high" "$heap" "$swap"
  if (( swap == 0 )); then printf '[UNZANET] Tanpa swap, build tetap dapat gagal bila kebutuhan memori melampaui batas.\n'; fi
  BUILD_UNIT="unzanet-build-$$-$(date +%s).service"
  install -d -m 0700 /etc/unzanet
  # Keep the complete first error, not just the trailing esbuild goroutine dump.
  local result=0
  (umask 077; build_run_bounded "$maximum" "$high" "$heap" 2>&1 | tee /etc/unzanet/build-phase.log) || result=$?
  if (( result != 0 )); then
    printf '[UNZANET] Build gagal (kode %s). Log privat: /etc/unzanet/build-phase.log; journal unit: %s\n' "$result" "$BUILD_UNIT" >&2
    return "$result"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then build_main "$@"; fi
