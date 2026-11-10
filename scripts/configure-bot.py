"""Sync bot environment and service without printing or shell-interpolating secrets."""
import argparse
import json
import os
from pathlib import Path
import re


def read_env(path):
    values = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        match = re.match(r'^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$', line.strip())
        if not match:
            continue
        key, value = match.groups()
        if value.startswith('"'):
            value = json.loads(value)
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1]
        else:
            value = value.split(' #', 1)[0].strip()
        values[key] = value
    return values


def synchronize(root):
    backend = read_env(root / 'backend/.env')
    bot_file = root / 'bot_whatsapp/.env'
    bot = read_env(bot_file)
    for key in ('DATABASE_URL', 'BOT_API_KEY', 'FRONTEND_URL'):
        if backend.get(key):
            bot[key] = backend[key]
    if not bot.get('DATABASE_URL', '').startswith('mysql://') or not bot.get('BOT_API_KEY'):
        raise ValueError('DATABASE_URL MySQL dan BOT_API_KEY backend wajib tersedia.')
    bot.setdefault('PORT', '3002')
    bot.setdefault('HOST', '127.0.0.1')
    bot.setdefault('BACKEND_URL', 'http://127.0.0.1:3001')
    bot.setdefault('WA_SESSION_FILE', 'data/whatsmeow.db')
    # Go verifies tokens with the backend and never needs its signing secret.
    bot.pop('JWT_SECRET', None)
    pending = bot_file.with_suffix('.env.pending')
    fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as file:
        file.write(''.join(key + '=' + json.dumps(value, ensure_ascii=False) + '\n' for key, value in bot.items()))
    pending.replace(bot_file)


def service(root, user, group):
    if any(not re.fullmatch(r'[a-z_][a-z0-9_-]*', value) for value in (user, group)):
        raise ValueError('User/group service tidak valid.')
    path = root.as_posix()
    if not re.fullmatch(r'/[A-Za-z0-9_./-]+', path):
        raise ValueError('Folder deployment tidak valid.')
    return f'''[Unit]
Description=UNZANET WhatsApp Go whatsmeow
Wants=network-online.target
After=network-online.target mysql.service
[Service]
Type=simple
User={user}
Group={group}
WorkingDirectory={path}/bot_whatsapp
ExecStart={path}/bot_whatsapp/bin/bot-whatsapp
Environment=TZ=Asia/Jakarta
UMask=0077
Restart=always
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
'''


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--user', default='unzanet')
    parser.add_argument('--group', default='unzanet')
    parser.add_argument('--service-name', default='unzanet-botwa')
    args = parser.parse_args()
    service_name = args.service_name.removesuffix('.service')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', service_name):
        raise ValueError('Nama service tidak valid.')
    synchronize(args.root)
    Path('/etc/systemd/system/' + service_name + '.service').write_text(service(args.root, args.user, args.group), encoding='utf-8')
