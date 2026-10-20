#!/usr/bin/env bash
# Installer SSTP Accel-PPP 1.14.0 untuk Ubuntu 24.04.
# Jalankan pada VPS aplikasi: npm run setupvpnserver
set -euo pipefail
umask 077

if [[ "${EUID}" -ne 0 ]]; then
    echo "Jalankan dengan sudo."
    exit 1
fi
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f /etc/unzanet/install-complete ]] || { echo 'Jalankan npm run install dahulu pada VPS ini.'; exit 1; }
. /etc/os-release
if [[ "${ID:-}" != ubuntu || "${VERSION_ID:-}" != 24.04 ]]; then
    echo "Installer ini khusus Ubuntu 24.04."
    exit 1
fi
VPS_IP="${1:-}"
if [[ -z "$VPS_IP" ]]; then
    read -r -p "IP publik IPv4 VPS: " VPS_IP </dev/tty
fi
if [[ ! "$VPS_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    echo "Isi IP publik IPv4, tanpa port."
    exit 1
fi
IFS=. read -r -a octets <<< "$VPS_IP"
for octet in "${octets[@]}"; do
    if (( 10#$octet > 255 )); then
        echo "IP tidak valid."
        exit 1
    fi
done
if [[ -e /etc/accel-ppp.conf || -e /etc/sstp-vpn ]]; then
    echo "Konfigurasi Accel-PPP/SSTP sudah ada. Installer berhenti agar tidak menimpanya."
    exit 1
fi
if ss -H -ltn 'sport = :4443' | grep -q .; then
    echo "TCP 4443 sedang digunakan. Periksa: sudo ss -ltnp 'sport = :4443'"
    exit 1
fi
if ip -4 route show table all | grep -Eq '(^|[[:space:]])10\.88\.0\.'; then
    echo "Ada route 10.88.0.x. Gunakan subnet VPN lain sebelum melanjutkan."
    exit 1
fi

apt-get update
apt-get install -y build-essential cmake git pkg-config libssl-dev \
    libpcre2-dev openssl ca-certificates iptables iproute2 kmod python3

BUILD_DIR="$(mktemp -d /usr/local/src/accel-sstp.XXXXXX)"
git clone --depth 1 --branch 1.14.0 \
    https://github.com/accel-ppp/accel-ppp.git "$BUILD_DIR/source"
cmake -S "$BUILD_DIR/source" -B "$BUILD_DIR/build" \
    -DCMAKE_INSTALL_PREFIX=/usr -DLIB_SUFFIX= \
    -DRADIUS=OFF -DSHAPER=OFF \
    -DBUILD_IPOE_DRIVER=OFF -DBUILD_VLAN_MON_DRIVER=OFF \
    -DBUILD_PPTP_DRIVER=OFF
cmake --build "$BUILD_DIR/build" --parallel 2
cmake --install "$BUILD_DIR/build"
ldconfig
modprobe ppp_generic
modprobe ppp_async

install -d -m 700 /etc/sstp-vpn
install -d -m 750 /var/log/accel-ppp
openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 3650 \
    -keyout /etc/sstp-vpn/ca.key -out /etc/sstp-vpn/ca.crt \
    -subj "/CN=UNZANET-SSTP-CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
openssl req -new -newkey rsa:2048 -nodes -sha256 \
    -keyout /etc/sstp-vpn/server.key -out /etc/sstp-vpn/server.csr \
    -subj "/CN=$VPS_IP"
cat > /etc/sstp-vpn/server.ext <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:$VPS_IP
EOF
openssl x509 -req -in /etc/sstp-vpn/server.csr \
    -CA /etc/sstp-vpn/ca.crt -CAkey /etc/sstp-vpn/ca.key \
    -CAcreateserial -out /etc/sstp-vpn/server.crt \
    -days 365 -sha256 -extfile /etc/sstp-vpn/server.ext
openssl verify -CAfile /etc/sstp-vpn/ca.crt /etc/sstp-vpn/server.crt
cat /etc/sstp-vpn/server.crt /etc/sstp-vpn/ca.crt \
    > /etc/sstp-vpn/server-chain.pem
install -d -m 755 /etc/unzanet-public
install -m 644 /etc/sstp-vpn/ca.crt /etc/unzanet-public/sstp-ca.crt
chmod 0755 /etc/unzanet-public

printf '# Managed by UNZANET VPN worker\n' > /etc/sstp-vpn/chap-secrets

cat > /etc/accel-ppp.conf <<'CONF'
[modules]
log_file
chap-secrets
auth_mschap_v2
sstp

[core]
log-error=/var/log/accel-ppp/core.log
thread-count=2

[common]
single-session=replace

[ppp]
ipv4=require
ipv6=deny
mtu=1400
mru=1400
mppe=deny
lcp-echo-interval=20
lcp-echo-timeout=120

[chap-secrets]
chap-secrets=/etc/sstp-vpn/chap-secrets
gw-ip-address=10.88.0.1

[sstp]
bind=0.0.0.0
port=4443
accept=ssl
ssl-protocol=tls1.2
ssl-pemfile=/etc/sstp-vpn/server-chain.pem
ssl-keyfile=/etc/sstp-vpn/server.key
ssl-ecdh-curve=prime256v1
ppp-max-mtu=1400
ifname=sstp%d

[client-ip-range]
disable

[log]
log-file=/var/log/accel-ppp/accel-ppp.log
log-fail-file=/var/log/accel-ppp/auth-fail.log
level=3

[cli]
tcp=127.0.0.1:2001
CONF
IPTABLES="$(command -v iptables)"
cat > /etc/systemd/system/accel-ppp.service <<EOF
[Unit]
Description=SSTP VPN with Accel-PPP
Wants=network-online.target
After=network-online.target ufw.service unzanet-vpn-ping.service
Requires=unzanet-vpn-ping.service

[Service]
Type=simple
ExecStartPre=/usr/sbin/ip address replace 10.88.0.1/32 dev lo
ExecStartPre=$IPTABLES -w -I FORWARD -i sstp+ -j DROP
ExecStart=/usr/sbin/accel-pppd -c /etc/accel-ppp.conf
ExecStopPost=-$IPTABLES -w -D FORWARD -i sstp+ -j DROP
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

if command -v ufw >/dev/null 2>&1; then
    ufw allow 4443/tcp
    ufw insert 1 allow in on sstp+ from 10.88.0.0/24 to 10.88.0.1 port 1812 proto udp
    ufw insert 2 allow in on sstp+ from 10.88.0.0/24 to 10.88.0.1 port 1813 proto udp
    ufw insert 3 deny in on sstp+ to any
fi
# UFW does not accept proto icmp in a simple rule. Allow tunnel gateway ping
# explicitly before UFW; all other input remains governed by UFW.
cat > /etc/systemd/system/unzanet-vpn-ping.service <<EOF
[Unit]
After=ufw.service
Before=accel-ppp.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$IPTABLES -w -I INPUT -i sstp+ -s 10.88.0.0/24 -d 10.88.0.1 -p icmp --icmp-type echo-request -j ACCEPT
ExecStop=$IPTABLES -w -D INPUT -i sstp+ -s 10.88.0.0/24 -d 10.88.0.1 -p icmp --icmp-type echo-request -j ACCEPT
[Install]
WantedBy=multi-user.target
EOF
export VPS_IP
python3 - "$ROOT_DIR" <<'PY'
import json, os, pathlib, sys
root = pathlib.Path(sys.argv[1])
state_path = pathlib.Path('/etc/unzanet/install.json')
state = json.loads(state_path.read_text())
# Persist server mode so rerunning the application installer retains this setup.
state.update(NETWORK_MODE='server', VPN_SERVER=os.environ['VPS_IP'], VPN_RADIUS_IP='10.88.0.1', VPN_ROUTER_IP='10.88.0.2', VPN_NETWORK='10.88.0.0/24')
state_path.write_text(json.dumps(state, indent=2) + '\n')
state_path.chmod(0o600)
env = root / 'backend/.env'
lines = env.read_text().splitlines()
values = {'VPN_SSTP_HOST': os.environ['VPS_IP'], 'RADIUS_SERVER_IP': '10.88.0.1', 'RADIUS_DISCONNECT_SOURCE_IP': '10.88.0.1'}
lines = [line for line in lines if line.split('=', 1)[0] not in values]
env.write_text('\n'.join(lines + [k + '=' + json.dumps(v) for k, v in values.items()]) + '\n')
PY
systemctl daemon-reload
systemctl enable --now unzanet-vpn-ping.service accel-ppp.service
systemctl is-active --quiet accel-ppp.service
bash "$ROOT_DIR/scripts/setup-vpn-sync.sh"
systemctl restart unzanet-backend

echo 'Server SSTP aktif pada TCP 4443; buka port ini di firewall provider VPS.'
echo 'Login web, buka Router > Klien VPN, lalu Tambah VPN. Tunggu status Siap.'
echo 'Pada Router / NAS pilih klien tersebut dan salin script ke MikroTik.'
echo 'CA diimpor otomatis melalui script. IP server RADIUS: 10.88.0.1.'
echo 'Sertifikat server berlaku 365 hari; perbarui sebelum kedaluwarsa.'
echo 'Periksa sesi: sudo accel-cmd show sessions'
