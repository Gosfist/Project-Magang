import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('installer_config', Path(__file__).with_name('installer-config.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class InstallerConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.config = dict(
            ROOT_DIR='/var/www/Project-Magang', WEB_URL='http://192.0.2.10',
            VPN_SERVER='vpn.example.net', VPN_USERNAME='vpn_radius', VPN_PASSWORD='test-only',
            VPN_NETWORK='10.88.0.0/24', VPN_RADIUS_IP='10.88.0.2', VPN_ROUTER_IP='10.88.0.3',
            ADMIN_EMAIL='admin@example.net', ADMIN_PASSWORD='not-a-real-password',
            DB_PASSWORD='a' * 48, RADIUS_DB_PASSWORD='b' * 48,
            JWT_SECRET='c' * 48, BOT_API_KEY='d' * 48,
        )

    def test_bad_networks_and_configuration_injection_are_rejected(self):
        for key, value in [
            ('VPN_ROUTER_IP', '10.88.0.2'), ('VPN_RADIUS_IP', '192.0.2.2'),
            ('VPN_ROUTER_IP', '10.88.0.255'), ('VPN_SERVER', 'host;reboot'), ('VPN_SERVER', '--help'),
            ('VPN_NETWORK', '0.0.0.0/0'), ('RADIUS_DB_PASSWORD', 'bad"config'),
            ('WEB_URL', 'http://host/path'), ('WEB_URL', 'http://host:3000'),
            ('ROOT_DIR', '/var/www/a\nExecStart=bad'), ('VPN_USERNAME', 'line\nbreak'),
        ]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                module.render({**self.config, key: value})

    def test_passwords_remain_literal_pppd_configuration_values(self):
        config = {**self.config, 'VPN_PASSWORD': 'quote" slash\\ $dollar #hash'}
        peer = module.render(config)['/etc/ppp/peers/sstp-radius']
        self.assertIn('password "quote\\" slash\\\\ $dollar #hash"', peer)
        self.assertIn('nodefaultroute', peer)
        self.assertNotIn('--cert-warn', peer)
        self.assertNotIn('defaultroute\n', peer.replace('nodefaultroute\n', ''))

    def test_backend_uses_radius_vpn_ip_and_shared_secrets_match_bot(self):
        files = module.render(self.config)
        backend = files['/var/www/Project-Magang/backend/.env']
        bot = files['/var/www/Project-Magang/bot_whatsapp/.env']
        self.assertIn('RADIUS_SERVER_IP="10.88.0.2"', backend)
        self.assertIn('RADIUS_DISCONNECT_SOURCE_IP="10.88.0.2"', backend)
        for key in ('DATABASE_URL', 'JWT_SECRET', 'BOT_API_KEY'):
            backend_value = next(line for line in backend.splitlines() if line.startswith(key + '='))
            self.assertIn(backend_value, bot)
        apache = files['/etc/apache2/sites-available/unzanet.conf']
        self.assertLess(apache.index('ProxyPass /api/wa '), apache.index('ProxyPass /api/ '))

    def test_nas_refresh_uses_root_owned_worker_and_no_web_sudo(self):
        files = module.render(self.config)
        worker = files['/etc/systemd/system/unzanet-radius-nas-refresh.service']
        self.assertIn('User=root', worker)
        self.assertIn('/usr/local/lib/unzanet/radius-nas-refresh.py', worker)
        self.assertNotIn('/var/www/', worker)
        self.assertIn('OnUnitActiveSec=60s', files['/etc/systemd/system/unzanet-radius-nas-refresh.timer'])
        self.assertIn('user=unzanet_radius', files['/etc/unzanet/radius-client.cnf'])
        self.assertIn('protocol=socket', module.refresh_files()['/etc/unzanet/radius-client.cnf'])

    def test_local_lab_does_not_require_sstp_and_has_no_vpn_service(self):
        config = {**self.config, 'NETWORK_MODE': 'local', 'VPN_SERVER': '', 'VPN_USERNAME': '', 'VPN_PASSWORD': '',
                  'VPN_NETWORK': '192.168.10.0/29', 'VPN_RADIUS_IP': '192.168.10.3', 'VPN_ROUTER_IP': '192.168.10.1'}
        files = module.render(config)
        self.assertNotIn('/etc/ppp/peers/sstp-radius', files)
        self.assertNotIn('/etc/systemd/system/sstp-radius.service', files)
        self.assertIn('RADIUS_SERVER_IP="192.168.10.3"', files['/var/www/Project-Magang/backend/.env'])

    def test_client_query_filter_preserves_accounting_and_other_vendor_queries(self):
        original = 'sql_user_name = "%{User-Name}"\nclient_query = "\\\n SELECT id, nasname, shortname, type, secret, server \\\n FROM ${client_table}"\nsimul_count_query = "SELECT COUNT(*) FROM radacct"\nsimul_verify_query = "SELECT * FROM radacct"\naccounting { query = "INSERT INTO radacct ..." }\n'
        patched = module.prepare_queries(original)
        self.assertIn('WHERE is_active = 1', patched)
        self.assertEqual(original.split('accounting {')[1], patched.split('accounting {')[1])
        self.assertEqual(module.prepare_queries(patched), patched)
        self.assertIn('simul_verify_query = ""', patched)
        self.assertIn('INTERVAL 900 SECOND', patched)
        self.assertIn("'radius_ack_'", patched)
        self.assertIn('SHA2(CONCAT(a.username,CHAR(0),a.nasipaddress,CHAR(0),a.acctsessionid),256)', patched)
        self.assertIn('FROM_UNIXTIME(CAST(d.value AS UNSIGNED))', patched)

    def test_unknown_query_format_is_not_silently_accepted(self):
        with self.assertRaises(ValueError):
            module.prepare_queries('unexpected = yes')

    def test_existing_sql_module_enables_clients_without_changing_credentials(self):
        original = 'sql {\n password="leave-it-alone"\n #read_clients = no\n client_table = "nas"\n $INCLUDE \u0024{modconfdir}/sql/main/\u0024{dialect}/queries.conf\n}\n'
        patched = module.prepare_sql_module(original)
        self.assertIn('read_clients = yes', patched)
        self.assertIn('password="leave-it-alone"', patched)
        self.assertIn('/queries-unzanet.conf', patched)
        self.assertEqual(module.prepare_sql_module(patched), patched)
        with self.assertRaises(ValueError):
            module.prepare_sql_module('read_clients = no\n client_table = "other"')


if __name__ == '__main__':
    unittest.main()
