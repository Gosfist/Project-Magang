import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
BASH = next((str(p) for p in [Path('C:/Program Files/Git/bin/bash.exe'), Path('C:/Program Files/Git/usr/bin/bash.exe')] if p.exists()), shutil.which('bash'))


@unittest.skipUnless(BASH, 'Bash is required')
class InstallerReloadTests(unittest.TestCase):
    def run_installer_reload(self, before, after, unlock_code=0):
        # Load real installer functions, excluding only its final main invocation.
        source = (ROOT / 'scripts/server-install.sh').read_text(encoding='utf-8')
        self.assertTrue(source.rstrip().endswith('main "$@"'))
        declarations = source.rsplit('\nmain "$@"', 1)[0]
        with tempfile.TemporaryDirectory() as folder:
            temporary = Path(folder)
            repo = temporary / 'repo'
            (repo / 'scripts').mkdir(parents=True)
            (repo / 'scripts/server-install.sh').write_text('''#!/usr/bin/env bash
set -eu
printf 'NEW_INSTALLER\\n'
if { true >&9; } 2>/dev/null; then
  printf 'ERROR_LOCK_STILL_OPEN\\n'; exit 7
fi
printf 'LOCK_CLOSED\\n'
''', encoding='utf-8', newline='\n')
            driver = temporary / 'driver.sh'
            driver.write_text(declarations + '''
ROOT_DIR="$TEST_REPO"
flock() {
  [[ "$1" == -u && "$2" == 9 ]] || return 9
  printf 'UNLOCK\\n'
  return "$TEST_UNLOCK_CODE"
}
exec 9>"$TEST_LOCK_FILE"
reload_installer_if_updated "$TEST_BEFORE" "$TEST_AFTER"
printf 'OLD_INSTALLER_CONTINUED\\n'
printf 'LOCK_RETAINED\\n' >&9
''', encoding='utf-8', newline='\n')
            lock_file = temporary / 'lock'
            env = {**os.environ, 'TEST_REPO': repo.as_posix(), 'TEST_LOCK_FILE': lock_file.as_posix(),
                   'TEST_BEFORE': before, 'TEST_AFTER': after, 'TEST_UNLOCK_CODE': str(unlock_code)}
            result = subprocess.run([BASH, str(driver)], cwd=ROOT, env=env, capture_output=True, text=True, timeout=15)
            return result, lock_file.read_text()

    def test_changed_revision_reexecutes_new_installer_after_releasing_lock(self):
        result, lock = self.run_installer_reload('a' * 40, 'b' * 40)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('NEW_INSTALLER', result.stdout)
        self.assertIn('LOCK_CLOSED', result.stdout)
        self.assertLess(result.stdout.index('UNLOCK'), result.stdout.index('NEW_INSTALLER'))
        self.assertNotIn('OLD_INSTALLER_CONTINUED', result.stdout)
        self.assertEqual(lock, '')

    def test_same_revision_continues_without_unlock_or_restart(self):
        result, lock = self.run_installer_reload('a' * 40, 'a' * 40)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('OLD_INSTALLER_CONTINUED', result.stdout)
        self.assertNotIn('UNLOCK', result.stdout)
        self.assertNotIn('NEW_INSTALLER', result.stdout)
        self.assertEqual(lock, 'LOCK_RETAINED\n')

    def test_failed_unlock_cannot_start_a_second_installer(self):
        result, _ = self.run_installer_reload('a' * 40, 'b' * 40, unlock_code=8)
        self.assertEqual(result.returncode, 8, result.stderr)
        self.assertNotIn('NEW_INSTALLER', result.stdout)
        self.assertNotIn('OLD_INSTALLER_CONTINUED', result.stdout)


if __name__ == '__main__':
    unittest.main()
