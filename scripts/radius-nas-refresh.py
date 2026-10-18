#!/usr/bin/env python3
"""Apply SQL NAS changes as root without giving the web service sudo access.

Installed copy: /usr/local/lib/unzanet/radius-nas-refresh.py (root-owned).
The timer reads only SQL client configuration and never prints shared secrets.
"""
import hashlib
import os
from pathlib import Path
import subprocess
import sys


CLIENT_QUERY = """SELECT id, HEX(nasname), HEX(COALESCE(shortname,'')),
HEX(type), HEX(secret), HEX(COALESCE(server,''))
FROM nas WHERE is_active = 1 ORDER BY id"""


def checked(command):
    result = subprocess.run(command, capture_output=True, check=False)
    if result.returncode:
        # mysql and radius validation errors can contain secrets; keep diagnostics
        # in the root-only file instead of the generally readable service journal.
        raise RuntimeError((result.stderr + result.stdout).decode('utf-8', errors='replace'))
    return result.stdout


def refresh(state_dir=Path('/var/lib/unzanet-radius'), run=checked):
    state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    state = state_dir / 'nas.sha256'
    rows = run(['/usr/bin/mysql', '--defaults-extra-file=/etc/unzanet/radius-client.cnf',
                '--batch', '--skip-column-names', 'unzanet', '-e', CLIENT_QUERY])
    fingerprint = hashlib.sha256(rows).hexdigest()
    if state.exists() and state.read_text().strip() == fingerprint:
        return False
    run(['/usr/sbin/freeradius', '-XC'])
    run(['/usr/bin/systemctl', 'restart', 'freeradius.service'])
    run(['/usr/bin/systemctl', 'is-active', '--quiet', 'freeradius.service'])
    pending = state_dir / 'nas.sha256.tmp'
    pending.write_text(fingerprint + '\n')
    pending.chmod(0o600)
    pending.replace(state)
    error_file = state_dir / 'last-error.log'
    error_file.unlink(missing_ok=True)
    return True


def main():
    os.umask(0o077)
    if os.geteuid() != 0:
        print('NAS refresh must run as root via its dedicated systemd timer.', file=sys.stderr)
        return 1
    try:
        if refresh():
            print('FreeRADIUS SQL NAS configuration refreshed.')
        return 0
    except Exception as error:
        state_dir = Path('/var/lib/unzanet-radius')
        state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        diagnostic = state_dir / 'last-error.log'
        diagnostic.write_text(str(error) + '\n')
        diagnostic.chmod(0o600)
        print('NAS refresh failed; previous fingerprint retained for retry. '
              'Read /var/lib/unzanet-radius/last-error.log privately as root.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
