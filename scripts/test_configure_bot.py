import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('configure_bot', Path(__file__).with_name('configure-bot.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ConfigureBotTests(unittest.TestCase):
    def test_sync_preserves_settings_and_uses_backend_database_and_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'backend').mkdir()
            (root / 'bot_whatsapp').mkdir()
            (root / 'backend/.env').write_text('DATABASE_URL="mysql://u:p%40ss@127.0.0.1/db"\nBOT_API_KEY="literal-$test&value"\nFRONTEND_URL="https://app.test"\n')
            (root / 'bot_whatsapp/.env').write_text('DATABASE_URL="mysql://old/db"\nJWT_SECRET="unused"\nPORT=3002\nWA_SESSION_FILE="data/custom.db"\n')
            module.synchronize(root)
            result = module.read_env(root / 'bot_whatsapp/.env')
            self.assertEqual(result['DATABASE_URL'], 'mysql://u:p%40ss@127.0.0.1/db')
            self.assertEqual(result['BOT_API_KEY'], 'literal-$test&value')
            self.assertEqual(result['WA_SESSION_FILE'], 'data/custom.db')
            self.assertEqual(result['HOST'], '127.0.0.1')
            self.assertNotIn('JWT_SECRET', result)

    def test_service_replaces_node_even_on_managed_installation(self):
        text = module.service(Path('/var/www/Project-Magang'), 'unzanet', 'unzanet')
        self.assertIn('ExecStart=/var/www/Project-Magang/bot_whatsapp/bin/bot-whatsapp', text)
        self.assertIn('UMask=0077', text)
        self.assertNotIn('/usr/bin/node', text)
        self.assertNotIn('EnvironmentFile', text)


if __name__ == '__main__':
    unittest.main()
