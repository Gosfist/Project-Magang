import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('frontend_prebuilt', ROOT / 'scripts/frontend-prebuilt.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class FrontendPrebuiltTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'frontend').mkdir()
        (self.root / 'frontend/source.txt').write_text('source')
        for args in [('init',), ('add', 'frontend'), ('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture')]:
            subprocess.run(['git', *args], cwd=self.root, check=True, capture_output=True)
        self.tree = MODULE.source_tree(self.root)
        (self.root / '.git/info/exclude').write_text('frontend/dist/\n')

    def artifact(self, contents=None, tree=None, extras=(), checksum=None):
        contents = contents or {'index.html': b'<script src="new.js"></script>', 'new.js': b'new', 'assets/deep/logo.svg': b'logo'}
        files = {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()}
        if checksum:
            files.update(checksum)
        manifest = json.dumps({'version': 1, 'sourceTree': tree or self.tree, 'files': files}).encode()
        path = self.root / 'releases/frontend.tar.gz'
        path.parent.mkdir(exist_ok=True)
        with tarfile.open(path, 'w:gz') as archive:
            for name, data in [('manifest.json', manifest), *[('browser/' + key, value) for key, value in contents.items()]]:
                entry = tarfile.TarInfo(name)
                entry.size = len(data)
                archive.addfile(entry, io.BytesIO(data))
            for entry in extras:
                archive.addfile(entry, io.BytesIO(b''))

    def test_check_validates_without_writing_and_deploy_keeps_old_chunks_index_last(self):
        self.artifact()
        MODULE.deploy(self.root, check_only=True)
        destination = self.root / 'frontend/dist/frontend/browser'
        self.assertFalse(destination.exists())
        destination.mkdir(parents=True)
        (destination / 'old.js').write_bytes(b'old')
        order = []
        original = os.replace
        def replace(source, target):
            order.append(Path(target).name)
            original(source, target)
        with patch.object(MODULE.os, 'replace', side_effect=replace):
            MODULE.deploy(self.root)
        self.assertEqual(order[-1], 'index.html')
        self.assertEqual((destination / 'old.js').read_bytes(), b'old')
        self.assertEqual((destination / 'assets/deep/logo.svg').read_bytes(), b'logo')

    def test_stale_frontend_is_rejected_before_writing(self):
        self.artifact(tree='0' * 40)
        with self.assertRaisesRegex(ValueError, 'berbeda dengan kode'):
            MODULE.deploy(self.root)
        self.assertFalse((self.root / 'frontend/dist').exists())

    def test_missing_artifact_requires_local_build_without_server_fallback(self):
        with self.assertRaisesRegex(ValueError, 'wajib tersedia'):
            MODULE.deploy(self.root)
        self.assertFalse((self.root / 'frontend/dist').exists())

    def test_changed_source_is_rejected(self):
        self.artifact()
        (self.root / 'frontend/source.txt').write_text('changed')
        with self.assertRaisesRegex(ValueError, 'perubahan lokal'):
            MODULE.deploy(self.root)

    def test_backend_only_commit_does_not_invalidate_frontend_package(self):
        self.artifact()
        (self.root / 'backend.txt').write_text('backend-only change')
        for args in [('add', 'backend.txt'), ('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'backend')]:
            subprocess.run(['git', *args], cwd=self.root, check=True, capture_output=True)
        MODULE.deploy(self.root, check_only=True)

    def test_only_release_package_is_visible_to_git(self):
        (self.root / '.gitignore').write_bytes((ROOT / '.gitignore').read_bytes())
        self.artifact()
        (self.root / 'releases/frontend-pending.tar.gz').write_bytes(b'pending')
        visible = subprocess.run(['git', 'check-ignore', 'releases/frontend.tar.gz'], cwd=self.root, capture_output=True)
        hidden = subprocess.run(['git', 'check-ignore', 'releases/frontend-pending.tar.gz'], cwd=self.root, capture_output=True)
        self.assertEqual(visible.returncode, 1)
        self.assertEqual(hidden.returncode, 0)

    def test_git_clone_and_pull_deliver_package_without_manual_upload(self):
        self.artifact()
        git = ['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid']
        subprocess.run([*git, 'add', 'releases/frontend.tar.gz'], cwd=self.root, check=True, capture_output=True)
        subprocess.run([*git, 'commit', '-m', 'release'], cwd=self.root, check=True, capture_output=True)
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory) / 'server'
            subprocess.run(['git', 'clone', '--quiet', str(self.root), str(checkout)], check=True, capture_output=True)
            (checkout / '.git/info/exclude').write_text('frontend/dist/\n')
            MODULE.deploy(checkout, check_only=True)
            MODULE.deploy(checkout)
            self.artifact(contents={'index.html': b'updated', 'next.js': b'next'})
            subprocess.run([*git, 'add', 'releases/frontend.tar.gz'], cwd=self.root, check=True, capture_output=True)
            subprocess.run([*git, 'commit', '-m', 'next release'], cwd=self.root, check=True, capture_output=True)
            subprocess.run(['git', 'pull', '--ff-only'], cwd=checkout, check=True, capture_output=True)
            MODULE.deploy(checkout)
            self.assertEqual((checkout / 'frontend/dist/frontend/browser/index.html').read_bytes(), b'updated')
            self.assertTrue((checkout / 'frontend/dist/frontend/browser/new.js').is_file())
            self.assertTrue((checkout / 'frontend/dist/frontend/browser/next.js').is_file())
            self.assertEqual(subprocess.check_output(['git', 'diff', '--name-only'], cwd=checkout), b'')

    def test_damaged_asset_and_missing_index_are_rejected(self):
        self.artifact(checksum={'new.js': '0' * 64})
        with self.assertRaisesRegex(ValueError, 'Checksum file'):
            MODULE.deploy(self.root)
        self.artifact(contents={'new.js': b'new'})
        with self.assertRaisesRegex(ValueError, 'index.html'):
            MODULE.deploy(self.root)

    def test_traversal_link_duplicate_and_unlisted_files_are_rejected(self):
        for name in ('../outside', '/tmp/outside', 'browser/../../outside', 'browser\\outside', 'browser/new.js', 'browser/unlisted.js'):
            with self.subTest(name=name):
                self.artifact(extras=[tarfile.TarInfo(name)])
                with self.assertRaises(ValueError):
                    MODULE.deploy(self.root)
        link = tarfile.TarInfo('browser/link')
        link.type = tarfile.SYMTYPE
        link.linkname = '/tmp/outside'
        self.artifact(extras=[link])
        with self.assertRaisesRegex(ValueError, 'symlink'):
            MODULE.deploy(self.root)

    @unittest.skipIf(os.name == 'nt', 'Creating symlinks requires Windows developer mode/admin')
    def test_existing_destination_symlink_cannot_overwrite_outside(self):
        self.artifact()
        outside = self.root / 'outside'
        outside.mkdir()
        destination = self.root / 'frontend/dist/frontend/browser'
        destination.parent.mkdir(parents=True)
        destination.symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            MODULE.deploy(self.root)
        self.assertEqual(list(outside.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
