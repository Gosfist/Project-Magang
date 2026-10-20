import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
BASH = next((str(p) for p in [Path('C:/Program Files/Git/bin/bash.exe'), Path('C:/Program Files/Git/usr/bin/bash.exe')] if p.exists()), shutil.which('bash'))


@unittest.skipUnless(BASH, 'Bash is required')
class InstallerSshTests(unittest.TestCase):
    def run_prepare(self, output, exit_code=0, connection=''):
        source = (ROOT / 'scripts/server-install.sh').read_text(encoding='utf-8')
        declarations = source.rsplit('\nmain "$@"', 1)[0]
        with tempfile.TemporaryDirectory() as directory:
            temporary = Path(directory)
            fake_sshd = temporary / 'sshd.sh'
            fake_sshd.write_text('''#!/usr/bin/env bash
[[ "$1" == -T ]] || exit 9
[[ -d "$TEST_SSH_RUNTIME" ]] || { echo 'Missing privilege separation directory' >&2; exit 255; }
if [[ "$TEST_SSH_EXIT" != 0 ]]; then
  printf '%s\\n' "$TEST_SSH_OUTPUT" >&2
  exit "$TEST_SSH_EXIT"
fi
printf '%s\\n' "$TEST_SSH_OUTPUT"
''', encoding='utf-8', newline='\n')
            driver = temporary / 'driver.sh'
            driver.write_text(declarations + '''
install() {
  [[ "$*" == "-d -o root -g root -m 0755 $TEST_SSH_RUNTIME" ]] || return 9
  mkdir -p "$TEST_SSH_RUNTIME"
}
ufw() { printf 'UFW %s\\n' "$*"; }
prepare_ssh_firewall "$TEST_SSH_RUNTIME" "$TEST_SSH_DAEMON"
printf 'CONTINUED\\n'
''', encoding='utf-8', newline='\n')
            # Invoke through Bash so fixture execution does not depend on chmod on Windows.
            fake_sshd.chmod(0o755)
            env = {**os.environ, 'TEST_SSH_RUNTIME': (temporary / 'run-sshd').as_posix(),
                   'TEST_SSH_DAEMON': fake_sshd.as_posix(), 'TEST_SSH_OUTPUT': output,
                   'TEST_SSH_EXIT': str(exit_code), 'SSH_CONNECTION': connection}
            return subprocess.run([BASH, str(driver)], cwd=ROOT, env=env, text=True,
                                  capture_output=True, timeout=15)

    def test_creates_missing_runtime_before_reading_ssh_configuration(self):
        result = self.run_prepare('port 22\naddressfamily any')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('UFW allow 22/tcp', result.stdout)
        self.assertIn('CONTINUED', result.stdout)

    def test_keeps_custom_configured_and_current_connection_ports(self):
        result = self.run_prepare('port 22\nport 2222\nport 22', connection='192.0.2.1 45678 192.0.2.10 2200')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.count('UFW allow 22/tcp'), 1)
        self.assertIn('UFW allow 2222/tcp', result.stdout)
        self.assertIn('UFW allow 2200/tcp', result.stdout)

    def test_failed_validation_exposes_error_and_never_changes_firewall(self):
        result = self.run_prepare('/etc/ssh/sshd_config line 8: Bad configuration option', exit_code=255)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Bad configuration option', result.stderr)
        self.assertIn('Firewall belum diubah', result.stderr)
        self.assertNotIn('UFW ', result.stdout)
        self.assertNotIn('CONTINUED', result.stdout)

    def test_empty_or_invalid_port_never_changes_firewall(self):
        for output in ['addressfamily any', 'port 22\nport invalid', 'port 0', 'port 65536']:
            with self.subTest(output=output):
                result = self.run_prepare(output)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('UFW ', result.stdout)


if __name__ == '__main__':
    unittest.main()
