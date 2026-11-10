import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
BASH = next((str(p) for p in [Path('C:/Program Files/Git/bin/bash.exe'), Path('C:/Program Files/Git/usr/bin/bash.exe')] if p.exists()), shutil.which('bash'))


@unittest.skipUnless(BASH, 'Bash required')
class BuildBotTests(unittest.TestCase):
    def build(self, failure=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'scripts').mkdir()
            (root / 'bot_whatsapp/bin').mkdir(parents=True)
            (root / 'compiler').mkdir()
            shutil.copy2(ROOT / 'scripts/build-bot.sh', root / 'scripts/build-bot.sh')
            binary = root / 'bot_whatsapp/bin/bot-whatsapp'
            binary.write_text('previous-binary')
            compiler = root / 'compiler/go'
            compiler.write_text('''#!/usr/bin/env bash
set -eu
if [[ "$1" == env ]]; then printf 'go1.27.3'; exit 0; fi
[[ "${CGO_ENABLED:-}" == 0 ]] || exit 21
[[ "$*" == *'-p 1'* && "$*" == *'-mod=readonly'* ]] || exit 22
[[ "${FAIL_BUILD:-}" != 1 ]] || exit 17
while [[ $# -gt 0 ]]; do
  if [[ "$1" == -o ]]; then printf 'go-binary' > "$2"; exit 0; fi
  shift
done
exit 23
''', encoding='utf-8', newline='\n')
            compiler.chmod(0o755)
            result = subprocess.run([BASH, '-c', 'export PATH="$(cd "$TEST_ROOT/compiler" && pwd):$PATH"; bash "$TEST_ROOT/scripts/build-bot.sh"'],
                env={**os.environ, 'TEST_ROOT': root.as_posix(), 'FAIL_BUILD': '1' if failure else '0'},
                capture_output=True, text=True, timeout=30)
            return result, binary.read_text()

    def test_publishes_binary_after_successful_serial_build(self):
        result, binary = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(binary, 'go-binary')

    def test_build_failure_preserves_previous_binary(self):
        result, binary = self.build(failure=True)
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertEqual(binary, 'previous-binary')


if __name__ == '__main__':
    unittest.main()
