#!/usr/bin/env bash
# Called by npm run install after Apache is serving HTTP.
set -Eeuo pipefail

setup_web_https() {
  local domain email
  domain="$(python3 "$ROOT_DIR/scripts/installer-config.py" get --key TLS_DOMAIN)"
  if [[ -z "$domain" ]]; then
    printf '[UNZANET] URL memakai IP: HTTP tersedia. HTTPS otomatis memerlukan domain.\n'
    return
  fi
  email="$(python3 "$ROOT_DIR/scripts/installer-config.py" get --key TLS_EMAIL)"
  printf '\n[UNZANET] Memasang HTTPS untuk %s dan pembaruan sertifikat otomatis\n' "$domain"
  if ! certbot --apache --non-interactive --agree-tos --email "$email" \
      --cert-name "$domain" --keep-until-expiring --redirect -d "$domain"; then
    printf '\nHTTPS belum berhasil. Pastikan DNS A menuju IPv4 VPS dan TCP 80/443 terbuka di firewall provider.\n' >&2
    printf 'Jika memakai Cloudflare, ubah record website menjadi DNS only sementara, lalu ulangi npm run install.\n' >&2
    return 1
  fi
  apache2ctl configtest
  systemctl reload apache2
  systemctl enable --now certbot.timer
  # Verify the actual origin with the right Host, SNI and trusted certificate.
  # Never use -k or a Cloudflare edge response to claim origin TLS works.
  curl --fail --silent --show-error --max-time 15 --noproxy '*' \
    --resolve "$domain:443:127.0.0.1" "https://$domain/" -o /dev/null
  systemctl is-active --quiet certbot.timer
  printf '[UNZANET] HTTPS origin terverifikasi. Cloudflare boleh memakai Proxied + Full (strict).\n'
}

main() {
  [[ "$EUID" == 0 ]] || { echo 'Jalankan dengan sudo.' >&2; exit 1; }
  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  setup_web_https
}

main "$@"
