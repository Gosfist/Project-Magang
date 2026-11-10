import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('cleanup_bot', Path(__file__).with_name('cleanup-bot-node.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CleanupBotNodeTests(unittest.TestCase):
    def test_only_obsolete_bot_dependencies_are_removed_and_cleanup_is_repeatable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = ['bot_whatsapp/node_modules/baileys/index.js', 'backend/node_modules/keep.js',
                     'bot_whatsapp/.env', 'bot_whatsapp/auth_info/creds.json',
                     'bot_whatsapp/data/whatsmeow.db', 'bot_whatsapp/bin/bot-whatsapp']
            for name in files:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('fixture')
            for name in ('middleware', 'routes'):
                (root / 'bot_whatsapp/src' / name).mkdir(parents=True, exist_ok=True)
            module.cleanup(root)
            module.cleanup(root)
            self.assertFalse((root / 'bot_whatsapp/node_modules').exists())
            self.assertFalse((root / 'bot_whatsapp/src').exists())
            for name in files[1:]:
                self.assertEqual((root / name).read_text(), 'fixture')

    def test_custom_source_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'bot_whatsapp/src/custom.js'
            source.parent.mkdir(parents=True)
            source.write_text('keep')
            module.cleanup(root)
            self.assertEqual(source.read_text(), 'keep')

    def test_dependency_link_cannot_delete_backend(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            backend = root / 'backend/node_modules'
            backend.mkdir(parents=True)
            (backend / 'keep.js').write_text('keep')
            bot = root / 'bot_whatsapp'
            bot.mkdir()
            try:
                (bot / 'node_modules').symlink_to(backend, target_is_directory=True)
            except OSError:
                self.skipTest('Creating symlinks is unavailable')
            with self.assertRaises(ValueError):
                module.cleanup(root)
            self.assertEqual((backend / 'keep.js').read_text(), 'keep')


if __name__ == '__main__':
    unittest.main()
