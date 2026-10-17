#!/usr/bin/env bash
# Installer SSTP Accel-PPP 1.14.0 untuk Ubuntu 24.04.
# Jalankan: sudo bash install-sstp-ubuntu24.sh IP_PUBLIK_VPS
set -euo pipefail
umask 077

if [[ "${EUID}" -ne 0 ]]; then
    echo "Jalankan dengan sudo."
    exit 1
fi
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
if ss -H -ltn 'sport = :443' | grep -q .; then
    echo "TCP 443 sedang digunakan. Periksa: sudo ss -ltnp 'sport = :443'"
    exit 1
fi
if ip -4 route show table all | grep -Eq '(^|[[:space:]])10\.88\.0\.'; then
    echo "Ada route 10.88.0.x. Gunakan subnet VPN lain sebelum melanjutkan."
    exit 1
fi

apt-get update
apt-get install -y build-essential cmake git pkg-config libssl-dev \
    libpcre2-dev openssl ca-certificates iptables iproute2 kmod

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
install -m 644 /etc/sstp-vpn/ca.crt /root/sstp-ca.crt

RADIUS_PASS="$(openssl rand -hex 16)"
ROUTER_PASS="$(openssl rand -hex 16)"
printf 'vpn_radius * %s 10.88.0.2\nvpn_router01 * %s 10.88.0.3\n' \
    "$RADIUS_PASS" "$ROUTER_PASS" > /etc/sstp-vpn/chap-secrets
printf 'Server: %s:443\nUbuntu RADIUS: vpn_radius / %s / 10.88.0.2\nMikroTik: vpn_router01 / %s / 10.88.0.3\n' \
    "$VPS_IP" "$RADIUS_PASS" "$ROUTER_PASS" > /root/sstp-accounts.txt
unset RADIUS_PASS ROUTER_PASS

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
port=443
accept=ssl
ssl-protocol=tls1.2
ssl-pemfile=/etc/sstp-vpn/server-chain.pem
ssl-keyfile=/etc/sstp-vpn/server.key
ssl-ecdh-curve=prime256v1
ppp-max-mtu=1400
ifname=sstp%d

[client-ip-range]
10.88.0.0/24

[log]
log-file=/var/log/accel-ppp/accel-ppp.log
log-fail-file=/var/log/accel-ppp/auth-fail.log
level=3

[cli]
tcp=127.0.0.1:2001
CONF
printf 'net.ipv4.ip_forward=1\n' > /etc/sysctl.d/99-sstp-forward.conf
sysctl -p /etc/sysctl.d/99-sstp-forward.conf

IPTABLES="$(command -v iptables)"
cat > /etc/systemd/system/accel-ppp.service <<EOF
[Unit]
Description=SSTP VPN with Accel-PPP
Wants=network-online.target
After=network-online.target ufw.service

[Service]
Type=simple
ExecStartPre=$IPTABLES -w -I FORWARD -i sstp+ -o sstp+ -s 10.88.0.2/32 -d 10.88.0.3/32 -j ACCEPT
ExecStartPre=$IPTABLES -w -I FORWARD -i sstp+ -o sstp+ -s 10.88.0.3/32 -d 10.88.0.2/32 -j ACCEPT
ExecStart=/usr/sbin/accel-pppd -c /etc/accel-ppp.conf
ExecStopPost=-$IPTABLES -w -D FORWARD -i sstp+ -o sstp+ -s 10.88.0.2/32 -d 10.88.0.3/32 -j ACCEPT
ExecStopPost=-$IPTABLES -w -D FORWARD -i sstp+ -o sstp+ -s 10.88.0.3/32 -d 10.88.0.2/32 -j ACCEPT
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

if command -v ufw >/dev/null 2>&1; then
    ufw allow 443/tcp
    ufw route allow from 10.88.0.2 to 10.88.0.3
    ufw route allow from 10.88.0.3 to 10.88.0.2
fi
systemctl daemon-reload
systemctl enable --now accel-ppp.service
systemctl is-active --quiet accel-ppp.service

echo
echo "Server SSTP aktif. Buka inbound TCP 443 pada Cloud Firewall DigitalOcean."
echo "Akun tersimpan privat: /root/sstp-accounts.txt"
echo "CA publik untuk client: /root/sstp-ca.crt"
echo "Jangan bagikan file .key atau akun ke pihak lain."
echo "Sertifikat server berlaku 365 hari; perbarui sebelum kedaluwarsa."
echo "Periksa sesi: sudo accel-cmd show sessions"
