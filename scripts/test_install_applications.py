import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
BASH = next((str(path) for path in [Path('C:/Program Files/Git/bin/bash.exe'), Path('C:/Program Files/Git/usr/bin/bash.exe')] if path.exists()), shutil.which('bash'))


@unittest.skipUnless(BASH, 'Bash is required')
class InstallApplicationsTests(unittest.TestCase):
    def run_install(self, **changes):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ['backend', 'bot_whatsapp', 'frontend/dist/frontend/browser']:
                (root / name).mkdir(parents=True)
            (root / 'frontend/dist/frontend/browser/index.html').write_text('index')
            trace = root / 'trace'
            code = '''
source scripts/install-applications.sh
INSTALL_ROOT="$(cd "$TEST_ROOT" && pwd)"
python3() {
  printf 'artifact:%s\\n' "${2:-install}" >> "$TEST_TRACE"
  if [[ "${2:-}" == --check && "${FAIL_CHECK:-}" == 1 ]]; then return 19; fi
}
npm() {
  if [[ "$PWD" == "$INSTALL_ROOT" ]]; then
    printf 'root:%s\\n' "$*" >> "$TEST_TRACE"
  else
    printf '%s:%s\\n' "$(basename "$PWD")" "$*" >> "$TEST_TRACE"
  fi
  if [[ "$*" == 'run build' && "${FAIL_BUILD:-}" == 1 ]]; then return 17; fi
}
systemctl() { printf 'ERROR_SERVICE_CHANGE\\n' >> "$TEST_TRACE"; return 1; }
systemd-run() { printf 'ERROR_BUILD_LIMIT\\n' >> "$TEST_TRACE"; return 1; }
install_applications
'''
            result = subprocess.run([BASH, '-c', code], cwd=ROOT,
                env={**os.environ, 'TEST_ROOT': root.as_posix(), 'TEST_TRACE': trace.as_posix(), **changes},
                capture_output=True, text=True, timeout=20)
            return result, trace.read_text().splitlines() if trace.exists() else []

    def test_frontend_is_imported_without_compiler_dependencies_or_service_changes(self):
        result, trace = self.run_install()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(trace, ['artifact:--check', 'backend:ci', 'bot_whatsapp:ci',
            'backend:run prisma:generate', 'root:run database:check', 'backend:run build', 'artifact:install'])

    def test_missing_or_invalid_package_stops_before_application_dependencies(self):
        result, trace = self.run_install(FAIL_CHECK='1')
        self.assertEqual(result.returncode, 19, result.stderr)
        self.assertEqual(trace, ['artifact:--check'])

    def test_backend_failure_does_not_publish_frontend(self):
        result, trace = self.run_install(FAIL_BUILD='1')
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertNotIn('artifact:install', trace)


if __name__ == '__main__':
    unittest.main()
