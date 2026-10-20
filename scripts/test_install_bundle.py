import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('bundle_config', ROOT / 'scripts/installer-config.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
BASH = next((str(p) for p in [Path('C:/Program Files/Git/bin/bash.exe')] if p.exists()), shutil.which('bash'))


class InstallBundleConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.config = module.create_config(dict(
            ROOT_DIR='/var/www/Project-Magang', WEB_URL='http://192.0.2.10',
            NETWORK_MODE='web', VPN_SERVER='', VPN_USERNAME='', VPN_PASSWORD='',
            VPN_RADIUS_IP='10.88.0.2', VPN_ROUTER_IP='10.88.0.3', VPN_NETWORK='10.88.0.0/24'))
        self.inputs = dict(WEB_URL='web.example.net', VPS_PUBLIC_IP='192.0.2.10', TLS_EMAIL='owner@example.net')

    def test_upgrade_web_install_to_complete_server_preserves_secrets(self):
        updated = module.configure_server(self.config, self.inputs)
        self.assertEqual(updated['WEB_URL'], 'https://web.example.net')
        self.assertEqual(updated['NETWORK_MODE'], 'server')
        self.assertEqual(updated['VPN_RADIUS_IP'], '10.88.0.1')
        self.assertEqual(updated['VPN_SERVER'], '192.0.2.10')
        for key in ('DB_PASSWORD', 'RADIUS_DB_PASSWORD', 'JWT_SECRET', 'BOT_API_KEY', 'ADMIN_PASSWORD'):
            self.assertEqual(updated[key], self.config[key])
        self.assertEqual(module.configure_server(updated, self.inputs), updated)
        files = module.render(updated)
        self.assertIn('FRONTEND_URL="https://web.example.net"', files[updated['ROOT_DIR'] + '/backend/.env'])
        self.assertNotIn('/etc/ppp/peers/sstp-radius', files)

    def test_http_domain_becomes_https_and_email_is_not_admin_login(self):
        updated = module.configure_server(self.config, {**self.inputs, 'WEB_URL': 'http://Web.Example.Net/'})
        self.assertEqual(updated['WEB_URL'], 'https://web.example.net')
        self.assertEqual(updated['TLS_EMAIL'], 'owner@example.net')
        self.assertEqual(updated['ADMIN_EMAIL'], 'admin@unzanet.com')

    def test_ip_only_install_does_not_request_untrusted_https(self):
        updated = module.configure_server(self.config, {**self.inputs, 'WEB_URL': 'http://192.0.2.10', 'TLS_EMAIL': ''})
        self.assertEqual(updated['TLS_DOMAIN'], '')
        self.assertEqual(updated['WEB_URL'], 'http://192.0.2.10')

    def test_invalid_input_never_changes_existing_state(self):
        before = json.dumps(self.config, sort_keys=True)
        for key, value in [('WEB_URL', 'https://192.0.2.10'), ('WEB_URL', 'https://web.example.net/login'),
                           ('WEB_URL', 'https://host;reboot'), ('WEB_URL', 'https://web.example.net:4443'),
                           ('VPS_PUBLIC_IP', '192.0.2.999'), ('VPS_PUBLIC_IP', '127.0.0.1'),
                           ('TLS_EMAIL', ''), ('TLS_EMAIL', 'owner@example.net\n--bad')]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                module.configure_server(self.config, {**self.inputs, key: value})
            self.assertEqual(json.dumps(self.config, sort_keys=True), before)

    def test_vpn_retry_preserves_existing_ca_and_accounts(self):
        with tempfile.TemporaryDirectory() as directory:
            etc = Path(directory)
            self.assertEqual(module.sstp_install_state('192.0.2.10', etc), 'fresh')
            vpn = etc / 'sstp-vpn'
            vpn.mkdir()
            (vpn / '.unzanet-server-ip').write_text('192.0.2.10\n')
            (vpn / 'ca.key').write_text('existing CA')
            (vpn / 'chap-secrets').write_text('existing account')
            before = {p.name: p.read_bytes() for p in vpn.iterdir()}
            self.assertEqual(module.sstp_install_state('192.0.2.10', etc), 'resume')
            with self.assertRaisesRegex(ValueError, 'IPv4 VPS berubah'):
                module.sstp_install_state('192.0.2.11', etc)
            self.assertEqual({p.name: p.read_bytes() for p in vpn.iterdir()}, before)

    def test_rejects_unmanaged_vpn_but_accepts_previous_unmarked_installer(self):
        with tempfile.TemporaryDirectory() as directory:
            etc = Path(directory)
            vpn = etc / 'sstp-vpn'
            vpn.mkdir()
            with self.assertRaisesRegex(ValueError, 'tidak ditimpa'):
                module.sstp_install_state('192.0.2.10', etc)
            for name in ('ca.key', 'ca.crt', 'server.key', 'server.crt', 'chap-secrets'):
                (vpn / name).write_text('existing file')
            unit = etc / 'systemd/system/accel-ppp.service'
            unit.parent.mkdir(parents=True)
            unit.write_text('Description=SSTP VPN with Accel-PPP\nExecStart=/usr/sbin/accel-pppd -c /etc/accel-ppp.conf\n')
            (etc / 'accel-ppp.conf').write_text('chap-secrets=/etc/sstp-vpn/chap-secrets\ngw-ip-address=10.88.0.1\nport=4443\nssl-keyfile=/etc/sstp-vpn/server.key\n')
            self.assertEqual(module.sstp_install_state('192.0.2.10', etc), 'resume')


@unittest.skipUnless(BASH, 'Bash is required')
class HttpsSetupTests(unittest.TestCase):
    def run_setup(self, domain='web.example.net', certbot_exit=0, curl_exit=0):
        source = (ROOT / 'scripts/setup-web-https.sh').read_text().rsplit('\nmain "$@"', 1)[0]
        with tempfile.TemporaryDirectory() as directory:
            driver = Path(directory) / 'driver.sh'
            driver.write_text(source + '''
ROOT_DIR=/repo
python3() {
  case "$*" in
    *TLS_DOMAIN) printf '%s' "$TEST_DOMAIN" ;;
    *TLS_EMAIL) printf '%s' 'owner@example.net' ;;
    *) return 9 ;;
  esac
}
certbot() { printf 'CERTBOT %s\\n' "$*"; return "$TEST_CERTBOT_EXIT"; }
apache2ctl() { printf 'APACHE %s\\n' "$*"; }
systemctl() { printf 'SYSTEMCTL %s\\n' "$*"; }
curl() { printf 'CURL %s\\n' "$*"; return "$TEST_CURL_EXIT"; }
setup_web_https
echo COMPLETED
''', encoding='utf-8', newline='\n')
            return subprocess.run([BASH, str(driver)], capture_output=True, text=True, timeout=15,
                                  env={**os.environ, 'TEST_DOMAIN': domain, 'TEST_CERTBOT_EXIT': str(certbot_exit),
                                       'TEST_CURL_EXIT': str(curl_exit)})

    def test_certificate_renewal_and_origin_verification_are_required(self):
        result = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('--apache --non-interactive --agree-tos --email owner@example.net', result.stdout)
        self.assertIn('--keep-until-expiring --redirect -d web.example.net', result.stdout)
        self.assertIn('enable --now certbot.timer', result.stdout)
        self.assertIn('--resolve web.example.net:443:127.0.0.1 https://web.example.net/', result.stdout)
        self.assertNotIn(' -k ', result.stdout)
        self.assertIn('COMPLETED', result.stdout)

    def test_certificate_failure_is_not_reported_as_success(self):
        result = self.run_setup(certbot_exit=1)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DNS only', result.stderr)
        self.assertNotIn('CURL ', result.stdout)
        self.assertNotIn('COMPLETED', result.stdout)

    def test_failed_origin_tls_verification_is_not_success(self):
        result = self.run_setup(curl_exit=60)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('HTTPS origin terverifikasi', result.stdout)
        self.assertNotIn('COMPLETED', result.stdout)

    def test_ip_only_install_skips_certbot(self):
        result = self.run_setup(domain='')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('CERTBOT ', result.stdout)


@unittest.skipUnless(BASH, 'Bash is required')
class BundleOrchestrationTests(unittest.TestCase):
    def run_bundle(self, https_exit=0, vpn_exit=0):
        source = (ROOT / 'scripts/server-install.sh').read_text().rsplit('\nmain "$@"', 1)[0]
        with tempfile.TemporaryDirectory() as directory:
            temporary = Path(directory)
            (temporary / 'scripts').mkdir()
            (temporary / 'scripts/setup-web-https.sh').write_text('echo HTTPS\nexit "$TEST_HTTPS_EXIT"\n', newline='\n')
            (temporary / 'install-sstp-ubuntu24.sh').write_text('echo "VPN $*"\nexit "$TEST_VPN_EXIT"\n', newline='\n')
            driver = temporary / 'driver.sh'
            driver.write_text(source + '''
ROOT_DIR="$TEST_ROOT"
NETWORK_MODE=server
setting() { printf '192.0.2.10'; }
finish_network_installation
echo COMPLETE
''', encoding='utf-8', newline='\n')
            return subprocess.run([BASH, str(driver)], capture_output=True, text=True, timeout=15,
                                  env={**os.environ, 'TEST_ROOT': temporary.as_posix(),
                                       'TEST_HTTPS_EXIT': str(https_exit), 'TEST_VPN_EXIT': str(vpn_exit)})

    def test_single_flow_installs_https_and_vpn_before_success(self):
        result = self.run_bundle()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('VPN 192.0.2.10 --integrated', result.stdout)
        self.assertLess(result.stdout.index('HTTPS'), result.stdout.index('VPN 192.0.2.10'))
        self.assertIn('COMPLETE', result.stdout)

    def test_https_or_vpn_failure_prevents_completion(self):
        for https_exit, vpn_exit in [(1, 0), (0, 1)]:
            with self.subTest(https_exit=https_exit, vpn_exit=vpn_exit):
                result = self.run_bundle(https_exit, vpn_exit)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('COMPLETE', result.stdout)
                if https_exit:
                    self.assertNotIn('VPN 192.0.2.10', result.stdout)


@unittest.skipUnless(BASH, 'Bash is required')
class SstpCertificateTests(unittest.TestCase):
    def test_existing_certificate_requires_matching_key_and_files_are_preserved(self):
        source = (ROOT / 'install-sstp-ubuntu24.sh').read_text().split('\nif [[ "${EUID}"', 1)[0]
        with tempfile.TemporaryDirectory() as directory:
            temporary = Path(directory)
            driver = temporary / 'verify.sh'
            driver.write_text(source + '''
cd "$TEST_CERT_DIR"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=test -keyout key.pem -out cert.pem 2>/dev/null
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out other.pem 2>/dev/null
verify_key_pair cert.pem key.pem
echo MATCHED
verify_key_pair cert.pem other.pem
echo INCORRECT_SUCCESS
''', encoding='utf-8', newline='\n')
            result = subprocess.run([BASH, str(driver)], capture_output=True, text=True, timeout=20,
                                    env={**os.environ, 'TEST_CERT_DIR': temporary.as_posix(),
                                         'MSYS_NO_PATHCONV': '1'})
            if result.returncode == 127:
                self.skipTest('OpenSSL is required')
            self.assertIn('MATCHED', result.stdout, result.stderr)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('tidak cocok', result.stderr)
            self.assertNotIn('INCORRECT_SUCCESS', result.stdout)
            self.assertTrue((temporary / 'cert.pem').read_text().startswith('-----BEGIN CERTIFICATE-----'))


if __name__ == '__main__':
    unittest.main()
