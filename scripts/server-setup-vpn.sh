#!/usr/bin/env bash
# Second stage: enable the Ubuntu RADIUS tunnel after the website is usable.
set -Eeuo pipefail
umask 077
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$EUID" != 0 ]]; then exec sudo bash "$ROOT_DIR/scripts/server-setup-vpn.sh" "$@"; fi
[[ $# == 0 ]] || { printf 'Jalankan: npm run setupvpn\n' >&2; exit 1; }
[[ -f /etc/unzanet/install-complete ]] || { printf 'Selesaikan npm run install dan buka website dahulu.\n' >&2; exit 1; }
exec 9>/run/lock/unzanet-install.lock
flock -n 9 || { printf 'Installer lain masih berjalan.\n' >&2; exit 1; }
setting() { python3 "$ROOT_DIR/scripts/installer-config.py" get --key "$1"; }
[[ "$(setting ROOT_DIR)" == "$ROOT_DIR" ]] || { printf 'Jalankan dari repo yang dipakai saat instalasi.\n' >&2; exit 1; }
ask() {
  local key="$1" label="$2" default="${3:-}" value
  read -r -p "$label${default:+ [$default]}: " value </dev/tty
  printf -v "$key" '%s' "${value:-$default}"
  export "$key"
}
printf 'Website dan database tidak diinstal ulang. Siapkan gateway SSTP dan CA tepercaya pada Ubuntu dahulu.\n'
ask VPN_SERVER 'IP/domain gateway SSTP sesuai sertifikat' "$(setting VPN_SERVER)"
ask VPN_USERNAME 'Username SSTP khusus Ubuntu' "$(setting VPN_USERNAME)"
read -r -s -p 'Password SSTP Ubuntu (tidak ditampilkan): ' VPN_PASSWORD </dev/tty
printf '\n'
export VPN_PASSWORD
ask VPN_RADIUS_IP 'IP tunnel tetap Ubuntu, bukan IP internet/DHCP' "$(setting VPN_RADIUS_IP)"
ask VPN_ROUTER_IP 'IP tunnel tetap MikroTik pertama' "$(setting VPN_ROUTER_IP)"
ask VPN_NETWORK 'Subnet tunnel VPN' "$(setting VPN_NETWORK)"
python3 "$ROOT_DIR/scripts/installer-config.py" configure-vpn
unset VPN_PASSWORD
ufw allow in on sstp-radius from "$VPN_NETWORK" to any port 1812 proto udp
ufw allow in on sstp-radius from "$VPN_NETWORK" to any port 1813 proto udp
systemctl daemon-reload
systemctl enable sstp-radius.service
systemctl restart sstp-radius.service
systemctl restart unzanet-backend.service
for _ in {1..20}; do
  if ip -4 -o addr show dev sstp-radius 2>/dev/null | grep -Fq " $VPN_RADIUS_IP/"; then
    printf 'Ubuntu mendapat IP tunnel %s. Sekarang tambah NAS di web dan pasang script pada MikroTik.\n' "$VPN_RADIUS_IP"
    exit 0
  fi
  sleep 2
done
printf 'Website tetap terpasang. Tunnel belum mendapat IP %s; periksa sudo journalctl -u sstp-radius -n 60 --no-pager serta CA, akun dan rute gateway.\n' "$VPN_RADIUS_IP" >&2
exit 1
