#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$EUID" == 0 ]] || { echo 'Jalankan dengan sudo.' >&2; exit 1; }
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install -d -o root -g root -m 0700 /var/lib/unzanet-vpn
install -d -o root -g root -m 0755 /usr/local/lib/unzanet
install -o root -g root -m 0700 "$ROOT_DIR/scripts/vpn-sync.mjs" /usr/local/lib/unzanet/vpn-sync.mjs
cat > /etc/systemd/system/unzanet-vpn-sync.service <<'UNIT'
[Unit]
Description=Apply UNZANET VPN accounts to local SSTP server
After=mysql.service accel-ppp.service
[Service]
Type=oneshot
User=root
UMask=0077
ExecStart=/usr/bin/node /usr/local/lib/unzanet/vpn-sync.mjs
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict
ReadWritePaths=/etc/sstp-vpn /var/lib/unzanet-vpn
UNIT
cat > /etc/systemd/system/unzanet-vpn-sync.timer <<'UNIT'
[Unit]
Description=Apply pending UNZANET VPN accounts every 15 seconds
[Timer]
OnBootSec=10s
OnUnitActiveSec=15s
AccuracySec=1s
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now unzanet-vpn-sync.timer
systemctl start unzanet-vpn-sync.service
