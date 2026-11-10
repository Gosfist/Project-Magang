import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
BASH = next((str(p) for p in [Path('C:/Program Files/Git/bin/bash.exe'), Path('C:/Program Files/Git/usr/bin/bash.exe')] if p.exists()), shutil.which('bash'))


@unittest.skipUnless(BASH and shutil.which('git'), 'Bash and Git required')
class UpdaterReloadTests(unittest.TestCase):
    def run_update(self, mode='all', changed=True, divergent=False):
        source = (ROOT / 'scripts/server-update.sh').read_text(encoding='utf-8')
        declarations = source[source.index('log() {'):source.index('\ncd "$ROOT_DIR"')]
        pull = source[source.index('log "Ambil update terbaru dari Git"'):source.index('\nif [[ "$MODE" == all || "$MODE" == fe ]]')]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            remote, checkout = root / 'remote', root / 'checkout'
            remote.mkdir()

            def git(*args, cwd=remote):
                return subprocess.run(['git', *args], cwd=cwd, check=True, capture_output=True, text=True)

            git('init', '-b', 'main')
            git('config', 'user.email', 'fixture@example.test')
            git('config', 'user.name', 'Fixture')
            (remote / 'scripts').mkdir()
            updater = remote / 'scripts/server-update.sh'
            updater.write_text('#!/usr/bin/env bash\nprintf "NEW_UPDATER:%s\\n" "$1"\n', encoding='utf-8', newline='\n')
            git('add', '.'); git('commit', '-m', 'initial')
            git('clone', str(remote), str(checkout), cwd=root)
            if divergent:
                git('config', 'user.email', 'fixture@example.test', cwd=checkout)
                git('config', 'user.name', 'Fixture', cwd=checkout)
                (checkout / 'local.txt').write_text('local')
                git('add', '.', cwd=checkout); git('commit', '-m', 'local', cwd=checkout)
            if changed:
                updater.write_text(updater.read_text() + '# new revision\n', encoding='utf-8', newline='\n')
                git('add', '.'); git('commit', '-m', 'update')
            driver = root / 'driver.sh'
            driver.write_text('set -euo pipefail\nROOT_DIR="$TEST_REPO"\nMODE="$TEST_MODE"\n' + declarations + '''
stat() { printf fixture; }
runuser() { shift 3; "$@"; }
''' + pull + '\nprintf "OLD_UPDATER_CONTINUED\\n"\n', encoding='utf-8', newline='\n')
            return subprocess.run([BASH, str(driver)], cwd=ROOT,
                env={**os.environ, 'TEST_REPO': checkout.as_posix(), 'TEST_MODE': mode},
                capture_output=True, text=True, timeout=25)

    def test_git_pull_reexecutes_new_script_before_old_steps_in_every_mode(self):
        for mode in ('all', 'be', 'fe', 'bot'):
            with self.subTest(mode=mode):
                result = self.run_update(mode)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('NEW_UPDATER:' + mode, result.stdout)
                self.assertNotIn('OLD_UPDATER_CONTINUED', result.stdout)

    def test_unchanged_revision_does_not_loop_or_restart(self):
        result = self.run_update(changed=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('OLD_UPDATER_CONTINUED', result.stdout)
        self.assertNotIn('NEW_UPDATER:', result.stdout)

    def test_failed_fast_forward_stops_without_build_or_reload(self):
        result = self.run_update(divergent=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('OLD_UPDATER_CONTINUED', result.stdout)
        self.assertNotIn('NEW_UPDATER:', result.stdout)


if __name__ == '__main__':
    unittest.main()
