"""Configuration renderer for the Ubuntu installer. No shell interpolation of secrets."""
import argparse
import ipaddress
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
from urllib.parse import urlsplit


def initial_administrator(config):
    return {**config, 'ADMIN_EMAIL': 'admin@unzanet.com', 'ADMIN_PASSWORD': '123'}


def create_config(environment):
    keys = ['ROOT_DIR', 'WEB_URL', 'VPN_SERVER', 'VPN_USERNAME', 'VPN_PASSWORD',
            'VPN_RADIUS_IP', 'VPN_ROUTER_IP', 'VPN_NETWORK']
    config = {key: environment[key] for key in keys}
    config['NETWORK_MODE'] = environment.get('NETWORK_MODE', 'vpn')
    for key in ['DB_PASSWORD', 'RADIUS_DB_PASSWORD', 'JWT_SECRET', 'BOT_API_KEY']:
        config[key] = secrets.token_hex(24)
    config = initial_administrator(config)
    validate(config)
    return config


def validate(config):
    mode = config.get('NETWORK_MODE', 'vpn')
    if mode not in ('web', 'local', 'vpn', 'server'):
        raise ValueError('Mode jaringan harus web, local, vpn atau server.')
    root = PurePosixPath(config['ROOT_DIR'])
    if not str(root).startswith('/var/www/') or '..' in root.parts or not re.fullmatch(r'/[A-Za-z0-9_./-]+', str(root)):
        raise ValueError('Folder repo harus absolut tanpa spasi, tanda kutip, atau backslash.')
    url = urlsplit(config['WEB_URL'])
    if (url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password
            or url.path not in ('', '/') or url.query or url.fragment
            or (url.port is not None and not 1 <= url.port <= 65535)):
        raise ValueError('URL web harus http:// atau https:// diikuti IP atau domain dengan port valid dan tanpa path.')
    if not re.fullmatch(r'[A-Za-z0-9.-]+', url.hostname):
        raise ValueError('Host web harus IPv4 atau domain yang valid.')
    if mode == 'vpn' and not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?', config['VPN_SERVER']):
        raise ValueError('Server SSTP harus IPv4 atau domain tanpa port.')
    network = ipaddress.IPv4Network(config['VPN_NETWORK'])
    if network.prefixlen == 0:
        raise ValueError('Subnet VPN tidak boleh menjadi default route 0.0.0.0/0.')
    radius = ipaddress.IPv4Address(config['VPN_RADIUS_IP'])
    router = ipaddress.IPv4Address(config['VPN_ROUTER_IP'])
    if radius == router or any(ip not in network or ip in (network.network_address, network.broadcast_address) for ip in (radius, router)):
        raise ValueError('IP RADIUS dan MikroTik harus berbeda dan berada di subnet VPN.')
    if mode == 'vpn' and (not config['VPN_USERNAME'] or not config['VPN_PASSWORD']):
        raise ValueError('Username dan password SSTP wajib diisi.')
    for key in ['DB_PASSWORD', 'RADIUS_DB_PASSWORD', 'JWT_SECRET', 'BOT_API_KEY']:
        if not re.fullmatch(r'[a-f0-9]{48}', config[key]):
            raise ValueError('Secret installer harus mempertahankan format acak yang dibuat saat instalasi awal.')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', config['ADMIN_EMAIL']):
        raise ValueError('Email administrator tidak valid.')
    for value in config.values():
        if not isinstance(value, str) or any(c in value for c in '\r\n\x00'):
            raise ValueError('Konfigurasi harus berupa teks satu baris.')


def ppp_quote(value):
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def env_line(key, value):
    return key + '=' + json.dumps(value, ensure_ascii=False)


def refresh_files(config=None):
    credential = ('[client]\nhost=127.0.0.1\nuser=unzanet_radius\npassword='
                  + config['RADIUS_DB_PASSWORD'] + '\nprotocol=tcp\n') if config else '[client]\nuser=root\nprotocol=socket\n'
    return {
        '/etc/unzanet/radius-client.cnf': credential,
        '/etc/systemd/system/unzanet-radius-nas-refresh.service': '''[Unit]
Description=Apply registered UNZANET SQL NAS changes to FreeRADIUS
After=mysql.service freeradius.service
[Service]
Type=oneshot
User=root
UMask=0077
ExecStart=/usr/bin/python3 /usr/local/lib/unzanet/radius-nas-refresh.py
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=full
''',
        '/etc/systemd/system/unzanet-radius-nas-refresh.timer': '''[Unit]
Description=Check UNZANET SQL NAS client changes every minute
[Timer]
OnBootSec=20s
OnUnitActiveSec=60s
AccuracySec=5s
Unit=unzanet-radius-nas-refresh.service
[Install]
WantedBy=timers.target
''',
    }


def render(config):
    validate(config)
    root = config['ROOT_DIR']
    origin = config['WEB_URL'].rstrip('/')
    db_url = f"mysql://unzanet:{config['DB_PASSWORD']}@127.0.0.1:3306/unzanet"
    backend = {
        'PORT': '3001', 'FRONTEND_URL': origin, 'DATABASE_URL': db_url,
        'JWT_SECRET': config['JWT_SECRET'], 'JWT_EXPIRES_IN': '7d', 'LARAVEL_APP_KEY': '',
        'BOT_WHATSAPP_URL': 'http://127.0.0.1:3002', 'BOT_API_KEY': config['BOT_API_KEY'],
        'RADIUS_LOG_TIMEZONE': 'WIB', 'RADIUS_SERVER_IP': config['VPN_RADIUS_IP'] if config.get('NETWORK_MODE', 'vpn') != 'web' else '',
        'RADIUS_DISCONNECT_SOURCE_IP': config['VPN_RADIUS_IP'] if config.get('NETWORK_MODE', 'vpn') != 'web' else '',
        'VPN_SSTP_HOST': config.get('VPN_SERVER', '') if config.get('NETWORK_MODE') == 'server' else '',
        'RADIUS_ACCOUNTING_STALE_SECONDS': '900',
        'RADIUS_ACCOUNTING_TIMEZONE': 'WIB',
        'UPLOADS_DIR': root + '/uploads',
    }
    bot = {
        'PORT': '3002', 'BACKEND_URL': 'http://127.0.0.1:3001', 'FRONTEND_URL': origin,
        'DATABASE_URL': db_url, 'BOT_API_KEY': config['BOT_API_KEY'], 'JWT_SECRET': config['JWT_SECRET'],
    }
    files = {
        **refresh_files(config),
        root + '/backend/.env': '\n'.join(env_line(k, v) for k, v in backend.items()) + '\n',
        root + '/bot_whatsapp/.env': '\n'.join(env_line(k, v) for k, v in bot.items()) + '\n',
        '/etc/ppp/peers/sstp-radius': f'''# Managed by UNZANET installer
pty {ppp_quote('/usr/sbin/sstpc --ipparam sstp-radius --nolaunchpppd ' + config['VPN_SERVER'])}
name {ppp_quote(config['VPN_USERNAME'])}
password {ppp_quote(config['VPN_PASSWORD'])}
plugin sstp-pppd-plugin.so
sstp-sock /run/sstpc/sstpc-sstp-radius
ifname sstp-radius
noauth
refuse-eap
refuse-pap
refuse-chap
refuse-mschap
noipdefault
nodefaultroute
nodetach
persist
maxfail 0
holdoff 10
mtu 1400
mru 1400
noccp
lcp-echo-interval 20
lcp-echo-failure 5
''',
        '/etc/ppp/ip-up.d/99-unzanet-vpn': f'''#!/bin/sh
set -eu
if [ "${{1:-}}" = sstp-radius ]; then
    /usr/sbin/ip route replace {config['VPN_NETWORK']} dev "$1" src "$4"
fi
''',
        '/etc/systemd/system/sstp-radius.service': '''[Unit]
Description=UNZANET SSTP client to VPN gateway
Wants=network-online.target
After=network-online.target
[Service]
Type=simple
ExecStartPre=/usr/bin/install -d -m 0755 /run/sstpc
ExecStart=/usr/sbin/pppd call sstp-radius
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
''',
        '/etc/freeradius/3.0/mods-available/sql': f'''# Managed by UNZANET installer
sql {{
    dialect = "mysql"
    driver = "rlm_sql_mysql"
    server = "127.0.0.1"
    port = 3306
    login = "unzanet_radius"
    password = "{config['RADIUS_DB_PASSWORD']}"
    radius_db = "unzanet"
    acct_table1 = "radacct"
    acct_table2 = "radacct"
    postauth_table = "radpostauth"
    authcheck_table = "radcheck"
    authreply_table = "radreply"
    groupcheck_table = "radgroupcheck"
    groupreply_table = "radgroupreply"
    usergroup_table = "radusergroup"
    read_clients = yes
    client_table = "nas"
    group_attribute = "SQL-Group"
    pool {{
        start = 1
        min = 1
        max = 8
        spare = 1
        uses = 0
        retry_delay = 10
        lifetime = 0
        idle_timeout = 60
    }}
    $INCLUDE ${{modconfdir}}/sql/main/mysql/queries-unzanet.conf
}}
''',
        '/etc/freeradius/3.0/sites-available/unzanet': '''# Managed by UNZANET installer
server unzanet {
    listen {
        type = auth
        ipaddr = 0.0.0.0
        port = 1812
    }
    listen {
        type = acct
        ipaddr = 0.0.0.0
        port = 1813
    }
    authorize {
        filter_username
        preprocess
        chap
        mschap
        suffix
        sql
        expiration
        logintime
        pap
    }
    authenticate {
        Auth-Type PAP {
            pap
        }
        Auth-Type CHAP {
            chap
        }
        Auth-Type MS-CHAP {
            mschap
        }
    }
    preacct {
        preprocess
        acct_unique
        suffix
    }
    accounting {
        sql
    }
    session {
        sql
    }
    post-auth {
        sql
        Post-Auth-Type REJECT {
            sql
            attr_filter.access_reject
        }
    }
}
''',
        '/etc/apache2/sites-available/unzanet.conf': f'''# Managed by UNZANET installer
<VirtualHost *:80>
    ServerName {urlsplit(origin).hostname}
    DocumentRoot "{root}/frontend/dist/frontend/browser"
    ProxyRequests Off
    ProxyPreserveHost On
    ProxyPass /api/wa http://127.0.0.1:3002/api/wa
    ProxyPassReverse /api/wa http://127.0.0.1:3002/api/wa
    ProxyPass /api/ http://127.0.0.1:3001/api/
    ProxyPassReverse /api/ http://127.0.0.1:3001/api/
    Alias /uploads/ "{root}/uploads/"
    <Directory "{root}/frontend/dist/frontend/browser">
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted
        FallbackResource /index.html
    </Directory>
    <Directory "{root}/uploads">
        Options -Indexes
        Require all granted
    </Directory>
    ErrorLog ${{APACHE_LOG_DIR}}/unzanet-error.log
    CustomLog ${{APACHE_LOG_DIR}}/unzanet-access.log combined
</VirtualHost>
''',
    }
    for name, folder, entry, group in [
        ('unzanet-backend', 'backend', 'dist/main.js', 'www-data'),
        ('unzanet-botwa', 'bot_whatsapp', 'src/index.js', 'unzanet'),
    ]:
        files[f'/etc/systemd/system/{name}.service'] = f'''[Unit]
Description={name}
Wants=network-online.target
After=network-online.target mysql.service
[Service]
Type=simple
User=unzanet
Group={group}
WorkingDirectory={root}/{folder}
ExecStart=/usr/bin/node {root}/{folder}/{entry}
Environment=NODE_ENV=production
Environment=TZ=Asia/Jakarta
UMask=0027
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
'''
    files['/etc/unzanet/credentials.txt'] = f'''UNZANET initial installation credentials
Web: {origin}
Administrator: {config['ADMIN_EMAIL']}
Initial administrator password: {config['ADMIN_PASSWORD']}
After changing the password in the web, this initial password no longer applies.
Installer state and secrets: /etc/unzanet/install.json
Do not share this file or installer state.
'''
    if config.get('NETWORK_MODE', 'vpn') != 'vpn':
        for path in ['/etc/ppp/peers/sstp-radius', '/etc/ppp/ip-up.d/99-unzanet-vpn', '/etc/systemd/system/sstp-radius.service']:
            files.pop(path)
    return files


def vpn_transition(config, backend_text, changes):
    """Enable the Ubuntu tunnel after web setup, without rewriting application secrets."""
    if config.get('NETWORK_MODE', 'vpn') not in ('web', 'vpn'):
        raise ValueError('Setup bertahap VPN hanya untuk mode web atau vpn.')
    updated = {**config, **{key: changes[key] for key in (
        'VPN_SERVER', 'VPN_USERNAME', 'VPN_PASSWORD', 'VPN_RADIUS_IP', 'VPN_ROUTER_IP', 'VPN_NETWORK')}, 'NETWORK_MODE': 'vpn'}
    validate(updated)
    all_files = render(updated)
    paths = ['/etc/ppp/peers/sstp-radius', '/etc/ppp/ip-up.d/99-unzanet-vpn', '/etc/systemd/system/sstp-radius.service']
    files = {path: all_files[path] for path in paths}
    for key in ('RADIUS_SERVER_IP', 'RADIUS_DISCONNECT_SOURCE_IP'):
        replacement = env_line(key, updated['VPN_RADIUS_IP'])
        if re.search(r'(?m)^' + key + r'=', backend_text):
            backend_text = re.sub(r'(?m)^' + key + r'=[^\r\n]*', lambda _: replacement, backend_text)
        else:
            backend_text = backend_text.rstrip('\r\n') + '\n' + replacement + '\n'
    files[updated['ROOT_DIR'] + '/backend/.env'] = backend_text
    return updated, files


def prepare_queries(text):
    replacement = 'client_query = "SELECT id, nasname, shortname, type, secret, server FROM ${client_table} WHERE is_active = 1"'
    text, count = re.subn(r'(?m)^client_query\s*=\s*"(?:\\[\s\S]|[^"\\])*"', lambda _: replacement, text, count=1)
    if count != 1:
        raise ValueError('Format client_query FreeRADIUS tidak dikenali; konfigurasi tidak diubah.')
    # Count fresh SQL sessions only. Avoid checkrad, SNMP, and false accounting Stop.
    # Signed Disconnect ACK markers exclude just the acknowledged session lifetime.
    simultaneous = ('simul_count_query = "SELECT COUNT(*) FROM ${acct_table1} a '
                    'LEFT OUTER JOIN nasreload n USING (nasipaddress) '
                    'LEFT JOIN website_settings d ON d.`key` = CONCAT(\'radius_ack_\', '
                    'SHA2(CONCAT(a.username,CHAR(0),a.nasipaddress,CHAR(0),a.acctsessionid),256)) '
                    'WHERE a.username = \'%{SQL-User-Name}\' AND a.acctstoptime IS NULL '
                    'AND (a.acctstarttime > n.reloadtime OR n.reloadtime IS NULL) '
                    'AND COALESCE(a.acctupdatetime,a.acctstarttime) >= DATE_SUB(NOW(), INTERVAL 900 SECOND) '
                    'AND COALESCE(a.acctupdatetime,a.acctstarttime) <= DATE_ADD(NOW(), INTERVAL 60 SECOND) '
                    'AND (d.`key` IS NULL OR a.acctstarttime > FROM_UNIXTIME(CAST(d.value AS UNSIGNED)))"')
    for key, replacement in [('simul_count_query', simultaneous), ('simul_verify_query', 'simul_verify_query = ""')]:
        text, count = re.subn(r'(?m)^' + key + r'\s*=\s*"(?:\\[\s\S]|[^"\\])*"',
                              lambda _: replacement, text, count=1)
        if count != 1:
            raise ValueError('Format ' + key + ' tidak dikenali; tidak mengaktifkan pengecekan SNMP/checkrad.')
    return text


def prepare_sql_module(text):
    if not re.search(r'(?m)^\s*client_table\s*=\s*"?nas"?\s*$', text):
        raise ValueError('SQL client_table bukan nas; periksa konfigurasi FreeRADIUS secara manual.')
    text, count = re.subn(r'(?m)^[ \t]*#?[ \t]*read_clients[ \t]*=[ \t]*(?:yes|no)[ \t]*$',
                          '    read_clients = yes', text, count=1)
    if count != 1:
        raise ValueError('read_clients tidak dikenali; konfigurasi tidak diubah.')
    pattern = r'(?m)^([ \t]*\$INCLUDE[ \t]+\$\{modconfdir\}/sql/main/(?:mysql|\$\{dialect\})/queries)(?:-unzanet)?(\.conf)[ \t]*$'
    text, count = re.subn(pattern, r'\1-unzanet\2', text, count=1)
    if count != 1:
        raise ValueError('Include query MySQL tidak dikenali; periksa konfigurasi manual.')
    return text


def disable_unused_eap(config_root=Path('/etc/freeradius/3.0')):
    # The managed PPPoE virtual server uses PAP, CHAP and MS-CHAP, not EAP.
    # Leave mods-available/eap intact so the package configuration is preserved.
    enabled = Path(config_root) / 'mods-enabled/eap'
    if enabled.is_symlink():
        enabled.unlink()
    elif enabled.exists():
        raise ValueError('mods-enabled/eap bukan symlink bawaan. Periksa konfigurasi EAP manual; file tidak dihapus.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['create', 'get', 'render', 'queries', 'refresh', 'sql-module', 'configure-vpn', 'radius-modules', 'admin-defaults'])
    parser.add_argument('--config', default='/etc/unzanet/install.json')
    parser.add_argument('--key')
    parser.add_argument('--source')
    args = parser.parse_args()
    state = Path(args.config)
    if args.action == 'radius-modules':
        disable_unused_eap()
        print('Modul EAP bawaan dinonaktifkan; PPPoE memakai PAP, CHAP dan MS-CHAP.')
        return
    if args.action == 'create':
        config = create_config(os.environ)
        with state.open('x', encoding='utf-8') as file:
            os.chmod(state, 0o600)
            json.dump(config, file, indent=2)
        return
    if args.action == 'queries':
        print(prepare_queries(Path(args.source).read_text()), end='')
        return
    if args.action == 'sql-module':
        print(prepare_sql_module(Path(args.source).read_text()), end='')
        return
    config = json.loads(state.read_text()) if state.exists() else None
    if config:
        validate(config)
    elif args.action != 'refresh':
        raise ValueError('State installer tidak ditemukan.')
    if args.action == 'admin-defaults':
        updated = initial_administrator(config)
        if updated != config:
            pending = state.with_name(state.name + '.tmp')
            with pending.open('w', encoding='utf-8') as file:
                os.chmod(pending, 0o600)
                json.dump(updated, file, indent=2)
            pending.replace(state)
        return
    if args.action == 'configure-vpn':
        if os.geteuid() != 0:
            raise ValueError('Konfigurasi VPN Ubuntu harus dijalankan dengan sudo.')
        backend_file = Path(config['ROOT_DIR']) / 'backend/.env'
        changes = {key: os.environ[key] for key in ('VPN_SERVER', 'VPN_USERNAME', 'VPN_PASSWORD', 'VPN_RADIUS_IP', 'VPN_ROUTER_IP', 'VPN_NETWORK')}
        updated, files = vpn_transition(config, backend_file.read_text(), changes)
        # Keep existing .env ownership and unrelated secrets/settings unchanged.
        for filename, content in files.items():
            file = Path(filename)
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(content, encoding='utf-8')
            if '/peers/' in filename:
                file.chmod(0o600)
            elif '/ip-up.d/' in filename:
                file.chmod(0o755)
            elif filename.endswith('.service'):
                file.chmod(0o644)
        pending = state.with_suffix('.json.pending')
        pending.write_text(json.dumps(updated, indent=2), encoding='utf-8')
        pending.chmod(0o600)
        pending.replace(state)
        print('Konfigurasi SSTP Ubuntu disimpan; database, URL web dan secret aplikasi dipertahankan.')
        return
    if args.action == 'get':
        print(config.get(args.key, 'vpn' if args.key == 'NETWORK_MODE' else ''), end='')
    else:
        for filename, text in (refresh_files(config) if args.action == 'refresh' else render(config)).items():
            file = Path(filename)
            file.parent.mkdir(parents=True, exist_ok=True)
            mode = 0o600 if filename.endswith('.env') or filename.endswith('credentials.txt') or filename.endswith('radius-client.cnf') or '/peers/' in filename else 0o644
            if filename == '/etc/freeradius/3.0/mods-available/sql':
                mode = 0o640
            fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, mode)
            with os.fdopen(fd, 'w', encoding='utf-8') as output:
                os.fchmod(output.fileno(), mode)
                output.write(text)
        if args.action != 'refresh' and config.get('NETWORK_MODE', 'vpn') == 'vpn':
            os.chmod('/etc/ppp/ip-up.d/99-unzanet-vpn', 0o755)


if __name__ == '__main__':
    main()
