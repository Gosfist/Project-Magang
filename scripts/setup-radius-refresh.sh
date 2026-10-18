#!/usr/bin/env bash
# Install a root-owned worker; the backend never receives sudo or root secrets.
set -Eeuo pipefail
[[ "$EUID" == 0 ]] || { printf 'Jalankan setup-radius-refresh.sh dengan sudo.\n' >&2; exit 1; }
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install -d -o root -g root -m 0700 /etc/unzanet /var/lib/unzanet-radius
install -d -o root -g root -m 0755 /usr/local/lib/unzanet
install -o root -g root -m 0755 "$ROOT_DIR/scripts/radius-nas-refresh.py" /usr/local/lib/unzanet/radius-nas-refresh.py
python3 "$ROOT_DIR/scripts/installer-config.py" refresh
chown root:root /etc/unzanet/radius-client.cnf /etc/systemd/system/unzanet-radius-nas-refresh.{service,timer}
SQL_MODULE=/etc/freeradius/3.0/mods-available/sql
QUERY_DIR=/etc/freeradius/3.0/mods-config/sql/main/mysql
if [[ ! -L /etc/freeradius/3.0/mods-enabled/sql ]]; then
  printf 'Modul SQL FreeRADIUS belum aktif. Periksa panduan sebelum menjalankan worker NAS.\n' >&2
  exit 1
fi
SOURCE_QUERIES="$QUERY_DIR/queries.conf"
if [[ -f "$QUERY_DIR/queries-unzanet.conf" ]] && grep -q 'queries-unzanet.conf' "$SQL_MODULE"; then
  SOURCE_QUERIES="$QUERY_DIR/queries-unzanet.conf"
fi
# Build both files before installing either one. Unknown custom formats stop here.
STAGING_DIR="$(mktemp -d /etc/unzanet/radius-config.XXXXXX)"
chmod 0700 "$STAGING_DIR"
python3 "$ROOT_DIR/scripts/installer-config.py" sql-module --source "$SQL_MODULE" > "$STAGING_DIR/sql"
python3 "$ROOT_DIR/scripts/installer-config.py" queries --source "$SOURCE_QUERIES" > "$STAGING_DIR/queries-unzanet.conf"
cp -a "$SQL_MODULE" "$STAGING_DIR/sql.before"
cp -a "$SOURCE_QUERIES" "$STAGING_DIR/queries.before"
install -o root -g freerad -m 0640 "$STAGING_DIR/sql" "$SQL_MODULE"
install -o root -g freerad -m 0640 "$STAGING_DIR/queries-unzanet.conf" "$QUERY_DIR/queries-unzanet.conf"
if [[ "$(mysql --protocol=socket --batch --skip-column-names -e "SELECT COUNT(*) FROM mysql.user WHERE User='unzanet_radius' AND Host='127.0.0.1'")" == 1 ]]; then
  mysql --protocol=socket -e "GRANT SELECT ON unzanet.website_settings TO 'unzanet_radius'@'127.0.0.1'"
fi
if ! freeradius -XC > /var/lib/unzanet-radius/setup-check.log 2>&1; then
  install -o root -g freerad -m 0640 "$STAGING_DIR/sql.before" "$SQL_MODULE"
  if [[ "$SOURCE_QUERIES" == "$QUERY_DIR/queries-unzanet.conf" ]]; then
    install -o root -g freerad -m 0640 "$STAGING_DIR/queries.before" "$SOURCE_QUERIES"
  fi
  printf 'Validasi FreeRADIUS gagal; konfigurasi sebelumnya dipulihkan. Log root: /var/lib/unzanet-radius/setup-check.log\n' >&2
  exit 1
fi
if ! cmp -s "$STAGING_DIR/sql.before" "$STAGING_DIR/sql" || ! cmp -s "$STAGING_DIR/queries.before" "$STAGING_DIR/queries-unzanet.conf"; then
  # Invalidate only this worker's cache so query changes are loaded even when
  # client IPs/secrets are unchanged. Successful restart writes a fresh hash.
  rm -f /var/lib/unzanet-radius/nas.sha256
fi
systemctl daemon-reload
systemctl enable --now unzanet-radius-nas-refresh.timer
systemctl start unzanet-radius-nas-refresh.service
