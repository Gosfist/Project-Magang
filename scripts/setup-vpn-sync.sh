#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$EUID" == 0 ]] || { echo 'Jalankan dengan sudo.' >&2; exit 1; }
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install -d -o root -g root -m 0700 /var/lib/unzanet-vpn
install -d -o root -g root -m 0755 /usr/local/lib/unzanet
install -o root -g root -m 0700 "$ROOT_DIR/scripts/vpn-sync.mjs" /usr/local/lib/unzanet/vpn-sync.mjs
install -o root -g root -m 0700 "$ROOT_DIR/scripts/vpn-status.mjs" /usr/local/lib/unzanet/vpn-status.mjs
cat > /etc/systemd/system/unzanet-vpn-status.service <<'UNIT'
[Unit]
Description=Read local SSTP sessions for UNZANET VPN status
After=accel-ppp.service
[Service]
Type=oneshot
User=root
UMask=0022
RuntimeDirectory=unzanet-vpn-status
RuntimeDirectoryMode=0755
RuntimeDirectoryPreserve=yes
ExecStart=/usr/bin/node /usr/local/lib/unzanet/vpn-status.mjs
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict
ReadWritePaths=/run/unzanet-vpn-status
UNIT
cat > /etc/systemd/system/unzanet-vpn-status.timer <<'UNIT'
[Unit]
Description=Refresh UNZANET SSTP session status every 10 seconds
[Timer]
OnBootSec=5s
OnUnitActiveSec=10s
AccuracySec=1s
[Install]
WantedBy=timers.target
UNIT
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
systemctl enable --now unzanet-vpn-status.timer
systemctl start unzanet-vpn-status.service
