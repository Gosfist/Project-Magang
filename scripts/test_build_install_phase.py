import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
BASH = next((str(p) for p in [Path('C:/Program Files/Git/bin/bash.exe'), Path('C:/Program Files/Git/usr/bin/bash.exe')] if p.exists()), shutil.which('bash'))


@unittest.skipUnless(BASH, 'Bash is required')
class BuildInstallationPhaseTests(unittest.TestCase):
    def run_shell(self, code, **changes):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            trace = directory / 'trace.txt'
            for name in ('backend', 'frontend', 'bot_whatsapp'):
                (directory / name).mkdir()
            index = directory / 'frontend/dist/frontend/browser/index.html'
            index.parent.mkdir(parents=True)
            index.write_text('test')
            env = {**os.environ, 'TEST_TRACE': trace.as_posix(), 'TEST_ROOT': directory.as_posix(), **changes}
            result = subprocess.run([BASH, '-c', "source scripts/build-install-phase.sh\n" + code], cwd=ROOT, env=env, capture_output=True, text=True, timeout=20)
            return result, trace.read_text().splitlines() if trace.exists() else []

    def test_limits_reserve_os_memory_and_fit_available_ram(self):
        result, _ = self.run_shell('build_limits 1940 1750\nbuild_limits 1940 1400\nbuild_limits 1536 1400')
        self.assertEqual(result.returncode, 0, result.stderr)
        values = [list(map(int, line.split())) for line in result.stdout.splitlines()]
        self.assertEqual(values, [[1400, 1120, 980], [1144, 915, 800], [1024, 819, 716]])
        for maximum, high, heap in values:
            self.assertLess(heap, high)
            self.assertLess(high, maximum)

    def test_insufficient_or_malformed_memory_fails_without_running_build(self):
        for values in ('1940 1200', '1024 900', 'bad 2048'):
            result, trace = self.run_shell('build_limits ' + values)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(trace, [])

    MOCK_SYSTEMCTL = '''
systemctl() {
  if [[ "$1" == is-active ]]; then
    case "$3" in mysql.service|apache2.service|freeradius.service|unzanet-radius-nas-refresh.timer) return 0;; *) return 3;; esac
  fi
  printf '%s:%s\\n' "$1" "$2" >> "$TEST_TRACE"
  if [[ "${FAIL_STOP:-}" == "$2" && "$1" == stop ]]; then return 11; fi
  if [[ "${FAIL_START:-}" == "$2" && "$1" == start ]]; then return 12; fi
}
'''

    def scenario(self, tail, **env):
        return self.run_shell(self.MOCK_SYSTEMCTL + '''
BUILD_ROOT=/test-root
BUILD_UNIT=unzanet-build-test.service
trap 'build_cleanup "$?"' EXIT
trap 'exit 143' TERM
trap 'exit 129' HUP
build_pause_services
''' + tail, **env)

    def assert_restored_original_services(self, trace):
        self.assertEqual([line for line in trace if line.startswith('start:')], [
            'start:mysql.service', 'start:apache2.service', 'start:freeradius.service',
            'start:unzanet-radius-nas-refresh.timer'])
        self.assertNotIn('start:unzanet-backend.service', trace)
        self.assertFalse(any('ssh' in line or 'sstp' in line for line in trace))

    def test_success_restores_only_previously_active_services_in_dependency_order(self):
        result, trace = self.scenario('true')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(trace[:4], ['stop:unzanet-radius-nas-refresh.timer', 'stop:freeradius.service', 'stop:apache2.service', 'stop:mysql.service'])
        self.assert_restored_original_services(trace)

    def test_build_failure_stops_child_group_and_restores_services(self):
        result, trace = self.scenario('systemd-run() { return 17; }\nbuild_run_bounded 1400 1120 980')
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertLess(trace.index('stop:unzanet-build-test.service'), trace.index('start:mysql.service'))
        self.assert_restored_original_services(trace)

    def test_partial_stop_failure_also_restores_original_states(self):
        result, trace = self.scenario('echo unexpected >> "$TEST_TRACE"', FAIL_STOP='apache2.service')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('stop:mysql.service', trace)
        self.assertNotIn('unexpected', trace)
        self.assert_restored_original_services(trace)

    def test_termination_restores_services(self):
        result, trace = self.scenario('kill -TERM $$')
        self.assertEqual(result.returncode, 143, result.stderr)
        self.assert_restored_original_services(trace)

    def test_ssh_hangup_restores_services(self):
        result, trace = self.scenario('kill -HUP $$')
        self.assertEqual(result.returncode, 129, result.stderr)
        self.assert_restored_original_services(trace)

    def test_failed_restart_is_reported_and_does_not_skip_other_services(self):
        result, trace = self.scenario('true', FAIL_START='mysql.service')
        self.assertEqual(result.returncode, 1)
        self.assertIn('Gagal memulihkan mysql.service', result.stderr)
        self.assert_restored_original_services(trace)

    def test_child_cgroup_has_hard_limit_oom_group_and_serial_worker_settings(self):
        result, trace = self.run_shell('''
BUILD_ROOT='/test root'
BUILD_UNIT=unzanet-build-test.service
systemd-run() { printf '%s\\n' "$@" >> "$TEST_TRACE"; }
build_run_bounded 1400 1120 980
''')
        self.assertEqual(result.returncode, 0, result.stderr)
        for argument in ['--wait', '--pipe', '--collect', '--working-directory=/test root', '--property=MemoryMax=1400M', '--property=MemoryHigh=1120M', '--property=MemorySwapMax=4G', '--property=CPUQuota=100%', '--property=OOMPolicy=kill', 'UNZANET_BUILD_HEAP_MB=980', 'NG_BUILD_MAX_WORKERS=1', 'NG_BUILD_PARALLEL_TS=0', 'GOMAXPROCS=1']:
            self.assertIn(argument, trace)
        self.assertEqual(trace[-1], '--worker')

    def test_dependencies_and_builds_run_serially_without_database_seed(self):
        result, trace = self.run_shell('''
BUILD_ROOT="$TEST_ROOT"
npm() { printf '%s:%s\\n' "$(basename "$PWD")" "$*" >> "$TEST_TRACE"; }
bash() { printf 'frontend-wrapper\\n' >> "$TEST_TRACE"; }
build_install_worker
''')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([line.split(':', 1)[1] if ':' in line else line for line in trace], [
            'ci', 'ci', 'ci', 'run prisma:generate', 'run database:check', 'run build', 'frontend-wrapper'])
        self.assertEqual([line.split(':', 1)[0] for line in trace[:4]], ['backend', 'frontend', 'bot_whatsapp', 'backend'])


if __name__ == '__main__':
    unittest.main()
