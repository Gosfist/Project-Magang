import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('nas_refresh', Path(__file__).with_name('radius-nas-refresh.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NasRefreshTests(unittest.TestCase):
    def test_first_run_restarts_once_then_unchanged_nas_does_not_restart(self):
        calls = []
        def run(command):
            calls.append(command)
            return b'1\t31302E38382E302E33\t736563726574\n' if command[0].endswith('mysql') else b''
        with tempfile.TemporaryDirectory() as folder:
            state_dir = Path(folder)
            self.assertTrue(module.refresh(state_dir, run))
            self.assertFalse(module.refresh(state_dir, run))
            self.assertEqual(sum('restart' in command for command in calls), 1)
            self.assertNotIn('736563726574', (state_dir / 'nas.sha256').read_text())

    def test_failed_validation_or_restart_preserves_last_good_fingerprint(self):
        for failed_step in ('-XC', 'restart', 'is-active'):
            with self.subTest(step=failed_step), tempfile.TemporaryDirectory() as folder:
                state_dir = Path(folder)
                state = state_dir / 'nas.sha256'
                state.write_text('previous-good-hash\n')
                calls = []
                def run(command):
                    calls.append(command)
                    if failed_step in command:
                        raise RuntimeError('validation or service failure')
                    return b'new-client-config' if command[0].endswith('mysql') else b''
                with self.assertRaises(RuntimeError):
                    module.refresh(state_dir, run)
                self.assertEqual(state.read_text(), 'previous-good-hash\n')
                if failed_step == '-XC':
                    self.assertFalse(any('restart' in command for command in calls))


if __name__ == '__main__':
    unittest.main()
