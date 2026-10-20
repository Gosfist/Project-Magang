#!/usr/bin/env bash
# Fresh Ubuntu 24.04 only. Run from the repository: npm run install
set -Eeuo pipefail
umask 027

log() { printf '\n[UNZANET] %s\n' "$1"; }
die() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }
ask() {
  local key="$1" label="$2" default="${3:-}" value
  read -r -p "$label${default:+ [$default]}: " value </dev/tty
  printf -v "$key" '%s' "${value:-$default}"
  export "$key"
}
setting() { python3 "$ROOT_DIR/scripts/installer-config.py" get --key "$1"; }
as_repo_owner() { runuser -u "$REPO_OWNER" -- "$@"; }
prepare_ssh_firewall() {
  local runtime_dir="${1:-/run/sshd}" sshd_command="${2:-/usr/sbin/sshd}"
  local ssh_config ssh_ports port client_ip client_port server_ip server_port
  # A fresh/socket-activated Ubuntu host may not have created this directory yet.
  install -d -o root -g root -m 0755 "$runtime_dir"
  if ! ssh_config="$("$sshd_command" -T)"; then
    die 'Pemeriksaan SSH gagal; lihat pesan sshd di atas. Firewall belum diubah. Periksa sudo /usr/sbin/sshd -T.'
  fi
  ssh_ports="$(awk '$1=="port" {print $2}' <<< "$ssh_config")"
  [[ -n "$ssh_ports" ]] || die 'Port SSH tidak ditemukan; firewall belum diubah.'
  # Keep the current connection reachable even with a custom ssh.socket port.
  if [[ -n "${SSH_CONNECTION:-}" ]]; then
    read -r client_ip client_port server_ip server_port <<< "$SSH_CONNECTION"
    ssh_ports+=$'\n'"$server_port"
  fi
  for port in $ssh_ports; do
    [[ "$port" =~ ^[0-9]{1,5}$ ]] && (( 10#$port >= 1 && 10#$port <= 65535 )) || die 'Port SSH tidak valid; firewall belum diubah.'
  done
  for port in $(sort -nu <<< "$ssh_ports"); do ufw allow "$port/tcp"; done
}
wait_http() {
  local address="$1" expected="$2" code
  for _ in {1..40}; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$address" || true)"
    [[ "$code" == "$expected" ]] && return 0
    sleep 2
  done
  die "Pemeriksaan $address gagal. Lihat journalctl service terkait."
}

finish_network_installation() {
  bash "$ROOT_DIR/scripts/setup-web-https.sh"
  if [[ "$NETWORK_MODE" == server ]]; then
    log 'Memasang atau melanjutkan server VPN SSTP pada VPS yang sama'
    bash "$ROOT_DIR/install-sstp-ubuntu24.sh" "$(setting VPN_SERVER)" --integrated
  fi
}

reload_installer_if_updated() {
  local previous_revision="$1" current_revision="$2"
  if [[ "$previous_revision" != "$current_revision" ]]; then
    log "Kode berubah ke ${current_revision:0:7}; memuat ulang installer sebelum memasang paket atau mengubah database"
    # Bash has already parsed main(): changing its file does not replace that function.
    flock -u 9
    exec 9>&-
    exec /bin/bash "$ROOT_DIR/scripts/server-install.sh"
  fi
}

configure_server_time() {
  local mysql_config_dir="${1:-/etc/mysql/mysql.conf.d}"
  log 'Menyelaraskan jam server ke WIB Asia/Jakarta dan mengaktifkan NTP'
  timedatectl set-timezone Asia/Jakarta
  timedatectl set-ntp true
  [[ "$(timedatectl show --property=Timezone --value)" == Asia/Jakarta ]] || die 'Zona waktu server belum Asia/Jakarta.'
  export TZ=Asia/Jakarta
  # Keep SQL DATETIME storage stable across host timezone changes and MySQL restarts.
  install -d -m 0755 "$mysql_config_dir"
  printf '[mysqld]\ndefault-time-zone = "+00:00"\n' > "$mysql_config_dir/99-unzanet-timezone.cnf"
  chmod 0644 "$mysql_config_dir/99-unzanet-timezone.cnf"
  systemctl enable --now mysql
  mysql --protocol=socket -e "SET GLOBAL time_zone = '+00:00'"
}

main() {
  if [[ "${1:-}" == --help ]]; then
    printf 'UNZANET installer Ubuntu 24.04\nJalankan: npm run install\nKonfigurasi ditanyakan sekali dan disimpan privat di /etc/unzanet/install.json\n'
    return
  fi
  [[ $# == 0 ]] || die 'Argumen tidak dikenal. Gunakan --help.'
  [[ "$(uname -s)" == Linux ]] || die 'Installer hanya dijalankan pada Ubuntu VPS baru.'
  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  export ROOT_DIR
  [[ "$ROOT_DIR" != *[[:space:]]* ]] || die 'Gunakan folder tanpa spasi, contoh /var/www/Project-Magang.'
  [[ "$ROOT_DIR" == /var/www/* ]] || die 'Letakkan repo di bawah /var/www agar user service dan Apache dapat membaca aplikasinya.'
  if [[ "$EUID" != 0 ]]; then
    exec sudo bash "$ROOT_DIR/scripts/server-install.sh"
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || die 'Gunakan Ubuntu Server 24.04 LTS untuk installer ini.'
  exec 9>/run/lock/unzanet-install.lock
  flock -n 9 || die 'Installer lain masih berjalan.'
  trap 'printf "\nInstaller berhenti pada baris %s. Data tidak direset. Periksa pesan error sebelumnya.\n" "$LINENO" >&2' ERR
  [[ -d "$ROOT_DIR/.git" ]] || die 'Folder ini harus hasil git clone repo Project-Magang.'
  REPO_OWNER="$(stat -c '%U' "$ROOT_DIR/.git")"
  as_repo_owner git -C "$ROOT_DIR" diff --quiet || die 'Ada perubahan kode lokal. Simpan dahulu sebelum instalasi.'
  as_repo_owner git -C "$ROOT_DIR" diff --cached --quiet || die 'Ada perubahan Git yang belum disimpan.'
  log 'Mengambil kode terbaru dari branch aktif'
  local previous_revision current_revision
  previous_revision="$(as_repo_owner git -C "$ROOT_DIR" rev-parse HEAD)"
  as_repo_owner git -C "$ROOT_DIR" pull --ff-only
  current_revision="$(as_repo_owner git -C "$ROOT_DIR" rev-parse HEAD)"
  reload_installer_if_updated "$previous_revision" "$current_revision"
  python3 "$ROOT_DIR/scripts/frontend-prebuilt.py" --check

  if [[ ! -f /etc/unzanet/install.json ]]; then
    [[ ! -f "$ROOT_DIR/backend/.env" && ! -f "$ROOT_DIR/bot_whatsapp/.env" ]] || die 'Ada .env lama tanpa state installer. Gunakan VM/repo baru agar secret lama tidak tertimpa.'
  fi
  log 'Memasang dependency Ubuntu'
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl git gnupg software-properties-common
  add-apt-repository -y universe
  apt-get update
  apt-get install -y mysql-server apache2 freeradius freeradius-mysql freeradius-utils \
    sstp-client ppp python3 build-essential pkg-config libssl-dev ufw openssl openssh-server netcat-openbsd \
    certbot python3-certbot-apache tzdata
  if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" != 22 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/unzanet-nodesource-22.sh
    bash /tmp/unzanet-nodesource-22.sh
    apt-get install -y nodejs
  fi
  [[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] || die 'Node.js 22 belum tersedia.'
  configure_server_time

  install -d -m 0700 /etc/unzanet
  if [[ ! -f /etc/unzanet/install.json ]]; then
    log 'Isi konfigurasi instalasi baru'
    local detected_ip
    detected_ip="$(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')"
    export WEB_URL="http://$detected_ip"
    # The supported new deployment is one VPS for web, RADIUS and SSTP.
    NETWORK_MODE=web
    export NETWORK_MODE
    export VPN_SERVER='' VPN_USERNAME='' VPN_PASSWORD=''
    export VPN_RADIUS_IP=10.88.0.2 VPN_ROUTER_IP=10.88.0.3 VPN_NETWORK=10.88.0.0/24
    python3 "$ROOT_DIR/scripts/installer-config.py" create
    unset VPN_PASSWORD
  fi
  [[ "$(setting ROOT_DIR)" == "$ROOT_DIR" ]] || die 'Lokasi repo berbeda dengan instalasi awal.'
  python3 "$ROOT_DIR/scripts/installer-config.py" admin-defaults
  if [[ "$(setting INSTALL_BUNDLE_VERSION)" != 1 ]]; then
    log 'Konfigurasi satu VPS: website HTTPS, RADIUS, dan server VPN'
    local current_web detected_public_ip
    current_web="$(setting WEB_URL)"
    detected_public_ip="$(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')"
    if [[ "$(setting NETWORK_MODE)" == server ]]; then
      detected_public_ip="$(setting VPN_SERVER)"
    fi
    ask WEB_URL 'Domain/URL website sebenarnya (domain otomatis memakai HTTPS)' "$current_web"
    ask VPS_PUBLIC_IP 'IPv4 publik VPS untuk VPN, tanpa URL/port' "$detected_public_ip"
    # This is the real certificate contact, separate from the fixed admin login.
    ask TLS_EMAIL 'Email aktif untuk sertifikat HTTPS (boleh kosong jika URL hanya IP)'
    python3 "$ROOT_DIR/scripts/installer-config.py" configure-server
  fi
  WEB_URL="$(setting WEB_URL)"
  VPN_NETWORK="$(setting VPN_NETWORK)"
  VPN_RADIUS_IP="$(setting VPN_RADIUS_IP)"
  VPN_ROUTER_IP="$(setting VPN_ROUTER_IP)"
  NETWORK_MODE="$(setting NETWORK_MODE)"
  DB_PASSWORD="$(setting DB_PASSWORD)"
  RADIUS_DB_PASSWORD="$(setting RADIUS_DB_PASSWORD)"

  log 'Menyiapkan database tanpa menghapus data'
  mysql --protocol=socket <<SQL
CREATE DATABASE IF NOT EXISTS unzanet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQL
  local table_count schema_hash
  table_count="$(mysql --protocol=socket -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='unzanet'")"
  schema_hash="$(sha256sum "$ROOT_DIR/backend/prisma/database.sql" | cut -d ' ' -f 1)"
  if [[ "$table_count" == 0 ]]; then
    mysql --protocol=socket unzanet < "$ROOT_DIR/backend/prisma/database.sql"
    printf '%s\n' "$schema_hash" > /etc/unzanet/database.sha256
  else
    [[ -f /etc/unzanet/database.sha256 ]] || die 'Database sudah berisi tabel tetapi belum ditandai oleh installer. Tidak diimpor/direset.'
    [[ "$(cat /etc/unzanet/database.sha256)" == "$schema_hash" ]] || die 'Skema SQL berbeda. Panduan ini untuk VM baru dengan database kosong; database berisi data tidak diubah otomatis.'
    log 'Database instalasi sebelumnya dipertahankan'
  fi
  mysql --protocol=socket <<SQL
CREATE USER IF NOT EXISTS 'unzanet'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER 'unzanet'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON unzanet.* TO 'unzanet'@'127.0.0.1';
CREATE USER IF NOT EXISTS 'unzanet_radius'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '$RADIUS_DB_PASSWORD';
ALTER USER 'unzanet_radius'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '$RADIUS_DB_PASSWORD';
GRANT SELECT ON unzanet.radcheck TO 'unzanet_radius'@'127.0.0.1';
GRANT SELECT ON unzanet.radreply TO 'unzanet_radius'@'127.0.0.1';
GRANT SELECT ON unzanet.radgroupcheck TO 'unzanet_radius'@'127.0.0.1';
GRANT SELECT ON unzanet.radgroupreply TO 'unzanet_radius'@'127.0.0.1';
GRANT SELECT ON unzanet.radusergroup TO 'unzanet_radius'@'127.0.0.1';
GRANT SELECT ON unzanet.nas TO 'unzanet_radius'@'127.0.0.1';
GRANT SELECT ON unzanet.website_settings TO 'unzanet_radius'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON unzanet.radacct TO 'unzanet_radius'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON unzanet.nasreload TO 'unzanet_radius'@'127.0.0.1';
GRANT SELECT, INSERT ON unzanet.radpostauth TO 'unzanet_radius'@'127.0.0.1';
SQL
  unset DB_PASSWORD RADIUS_DB_PASSWORD

  if ! id unzanet >/dev/null 2>&1; then
    useradd --system --create-home --home-dir /var/lib/unzanet --shell /usr/sbin/nologin unzanet
  fi
  usermod -a -G www-data unzanet
  install -d -o unzanet -g www-data -m 0750 "$ROOT_DIR/uploads" "$ROOT_DIR/uploads/ktp" "$ROOT_DIR/uploads/profile" "$ROOT_DIR/uploads/instalasi"
  install -d -o unzanet -g unzanet -m 0700 "$ROOT_DIR/bot_whatsapp/auth_info"
  if [[ ! -d /etc/unzanet/freeradius-backup ]]; then
    cp -a /etc/freeradius/3.0 /etc/unzanet/freeradius-backup
  fi
  python3 "$ROOT_DIR/scripts/installer-config.py" render
  chown unzanet:unzanet "$ROOT_DIR/backend/.env" "$ROOT_DIR/bot_whatsapp/.env"
  chown root:freerad /etc/freeradius/3.0/mods-available/sql
  chmod 0640 /etc/freeradius/3.0/mods-available/sql
  python3 "$ROOT_DIR/scripts/installer-config.py" queries \
    --source /etc/freeradius/3.0/mods-config/sql/main/mysql/queries.conf \
    > /etc/freeradius/3.0/mods-config/sql/main/mysql/queries-unzanet.conf
  chmod 0644 /etc/freeradius/3.0/mods-config/sql/main/mysql/queries-unzanet.conf
  for site in default inner-tunnel; do
    if [[ -L "/etc/freeradius/3.0/sites-enabled/$site" ]]; then
      unlink "/etc/freeradius/3.0/sites-enabled/$site"
    elif [[ -e "/etc/freeradius/3.0/sites-enabled/$site" ]]; then
      die "sites-enabled/$site bukan symlink bawaan. Periksa konfigurasi FreeRADIUS."
    fi
  done
  python3 "$ROOT_DIR/scripts/installer-config.py" radius-modules
  ln -sfn ../mods-available/sql /etc/freeradius/3.0/mods-enabled/sql
  ln -sfn ../sites-available/unzanet /etc/freeradius/3.0/sites-enabled/unzanet

  log 'Memasang dependency backend/bot dan frontend hasil build laptop'
  bash "$ROOT_DIR/scripts/install-applications.sh"
  export UNZANET_ADMIN_EMAIL="$(setting ADMIN_EMAIL)"
  export UNZANET_ADMIN_PASSWORD="$(setting ADMIN_PASSWORD)"
  (cd "$ROOT_DIR/backend" && node --env-file=.env --input-type=module <<'JS'
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
const prisma = new PrismaClient();
try {
  await prisma.user.upsert({
    where: { email: process.env.UNZANET_ADMIN_EMAIL }, update: {},
    create: { email: process.env.UNZANET_ADMIN_EMAIL, name: 'Administrator', role: 'admin', status: 'active', password: await hash(process.env.UNZANET_ADMIN_PASSWORD, 12) },
  });
} finally { await prisma.$disconnect(); }
JS
  )
  unset UNZANET_ADMIN_EMAIL UNZANET_ADMIN_PASSWORD
  [[ -f "$ROOT_DIR/frontend/dist/frontend/browser/index.html" ]] || die 'Build frontend tidak menghasilkan index.html.'

  log 'Memeriksa FreeRADIUS dan Apache'
  if ! freeradius -XC > /etc/unzanet/freeradius-check.log 2>&1; then
    die 'Validasi FreeRADIUS gagal. Baca sudo cat /etc/unzanet/freeradius-check.log secara privat.'
  fi
  a2enmod proxy proxy_http headers
  a2dissite 000-default.conf || true
  a2ensite unzanet.conf
  apache2ctl configtest

  log 'Menyiapkan firewall dan service otomatis saat boot'
  prepare_ssh_firewall
  ufw allow 80/tcp
  ufw allow 443/tcp
  if [[ "$NETWORK_MODE" == vpn ]]; then
    ufw allow in on sstp-radius from "$VPN_NETWORK" to any port 1812 proto udp
    ufw allow in on sstp-radius from "$VPN_NETWORK" to any port 1813 proto udp
  elif [[ "$NETWORK_MODE" == local ]]; then
    ufw allow from "$VPN_ROUTER_IP" to "$VPN_RADIUS_IP" port 1812 proto udp
    ufw allow from "$VPN_ROUTER_IP" to "$VPN_RADIUS_IP" port 1813 proto udp
  fi
  ufw --force enable
  systemctl daemon-reload
  if [[ "$NETWORK_MODE" == vpn ]]; then
    systemctl enable sstp-radius
    systemctl restart sstp-radius
  fi
  systemctl enable unzanet-backend unzanet-botwa freeradius apache2
  systemctl restart unzanet-backend unzanet-botwa freeradius apache2
  bash "$ROOT_DIR/scripts/setup-radius-refresh.sh"
  wait_http http://127.0.0.1:3001/api/auth/me 401
  wait_http http://127.0.0.1:3002/api/wa/health 200
  wait_http http://127.0.0.1/api/wa/health 200
  wait_http http://127.0.0.1/ 200
  finish_network_installation
  for service in mysql apache2 freeradius unzanet-backend unzanet-botwa; do
    systemctl is-active --quiet "$service"
  done
  touch /etc/unzanet/install-complete
  log "Aplikasi siap dibuka: $WEB_URL"
  printf 'Login administrator awal: admin@unzanet.com / 123\n'
  if [[ "$NETWORK_MODE" == local ]]; then
    printf 'Mode LAN: uji ping %s, lalu tambah NAS dengan IP tersebut.\n' "$VPN_ROUTER_IP"
  elif [[ "$NETWORK_MODE" == server ]]; then
    printf 'Server VPN lokal tersedia pada TCP 4443. Buat/pilih Klien VPN di website; IP RADIUS 10.88.0.1.\n'
  elif ip -4 -o addr show dev sstp-radius 2>/dev/null | grep -Fq " $VPN_RADIUS_IP/"; then
    printf 'Ubuntu sudah mendapat IP VPN %s. Lanjutkan setup SSTP MikroTik di install.doc.\n' "$VPN_RADIUS_IP"
  else
    printf 'VPN Ubuntu BELUM mendapat IP %s. Periksa journalctl -u sstp-radius sebelum menambah NAS.\n' "$VPN_RADIUS_IP"
  fi
  if [[ "$NETWORK_MODE" != web ]]; then
    printf 'Setelah jaringan siap: tambah NAS di web, salin script SSTP/RADIUS ke MikroTik, ping dua arah, tunggu refresh NAS maksimal sekitar 60 detik, lalu uji PPPoE dan Disconnect.\n'
  fi
  printf 'WhatsApp: buka menu Login Bot Wa dan scan QR dengan ponsel.\n'
}

main "$@"
