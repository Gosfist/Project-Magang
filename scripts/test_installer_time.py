import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
BASH = next((str(p) for p in [Path('C:/Program Files/Git/bin/bash.exe'),
                            Path('C:/Program Files/Git/usr/bin/bash.exe')] if p.exists()), shutil.which('bash'))


@unittest.skipUnless(BASH, 'Bash is required')
class InstallerTimeTests(unittest.TestCase):
    def run_setup(self, zone='Asia/Jakarta', ntp_exit='0'):
        source = (ROOT / 'scripts/server-install.sh').read_text(encoding='utf-8')
        declarations = source.rsplit('\nmain "$@"', 1)[0]
        with tempfile.TemporaryDirectory() as directory:
            temporary = Path(directory)
            driver = temporary / 'driver.sh'
            driver.write_text(declarations + '''
timedatectl() {
  printf 'CLOCK %s\\n' "$*" >&2
  if [[ "$1" == show ]]; then printf '%s\\n' "$TEST_ZONE"; fi
  if [[ "$1" == set-ntp ]]; then return "$TEST_NTP_EXIT"; fi
}
systemctl() { printf 'SERVICE %s\\n' "$*"; }
mysql() { printf 'SQL %s\\n' "$*"; }
configure_server_time "$TEST_MYSQL_DIR"
printf 'TZ=%s\\n' "$TZ"
''', encoding='utf-8', newline='\n')
            config = temporary / 'mysql'
            environment = {**os.environ, 'TEST_ZONE': zone, 'TEST_NTP_EXIT': ntp_exit,
                           'TEST_MYSQL_DIR': config.as_posix()}
            result = subprocess.run([BASH, str(driver)], cwd=ROOT, env=environment,
                                    text=True, capture_output=True, timeout=15)
            setting = config / '99-unzanet-timezone.cnf'
            return result, setting.read_text() if setting.exists() else None

    def test_host_uses_jakarta_but_new_sql_connections_and_restarts_keep_utc(self):
        result, setting = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('CLOCK set-timezone Asia/Jakarta', result.stderr)
        self.assertIn('CLOCK set-ntp true', result.stderr)
        self.assertIn('TZ=Asia/Jakarta', result.stdout)
        self.assertEqual(setting, '[mysqld]\ndefault-time-zone = "+00:00"\n')
        self.assertIn("SQL --protocol=socket -e SET GLOBAL time_zone = '+00:00'", result.stdout)
        self.assertNotIn('UPDATE ', result.stdout)

    def test_wrong_host_zone_stops_before_changing_database_settings(self):
        result, setting = self.run_setup(zone='UTC')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Zona waktu server belum Asia/Jakarta', result.stderr)
        self.assertIsNone(setting)
        self.assertNotIn('SQL ', result.stdout)

    def test_ntp_setup_failure_is_not_reported_as_synchronized(self):
        result, setting = self.run_setup(ntp_exit='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIsNone(setting)
        self.assertNotIn('SQL ', result.stdout)


if __name__ == '__main__':
    unittest.main()
