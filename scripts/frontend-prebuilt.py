"""Validate a local production artifact, then deploy assets before index.html."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import tempfile


MAX_BYTES = 256 * 1024 * 1024
MAX_FILES = 10000


def source_tree(root):
    # The Ubuntu installer runs as root, while the checkout may belong to its SSH user.
    git = ['git', '-c', 'safe.directory=' + str(root)]
    dirty = subprocess.check_output([*git, 'status', '--porcelain', '--untracked-files=all', '--', 'frontend'], cwd=root)
    if dirty.strip():
        raise ValueError('Kode frontend server memiliki perubahan lokal; samakan dengan commit paket dahulu.')
    return subprocess.check_output([*git, 'rev-parse', 'HEAD:frontend'], cwd=root, text=True).strip()


def safe_name(name):
    path = PurePosixPath(name)
    if (not name or '\\' in name or path.is_absolute() or '..' in path.parts
            or ':' in name or str(path) != name or any(part.startswith('.') for part in path.parts)):
        raise ValueError('Nama file paket tidak valid.')
    return path


def validate(archive, tree):
    members = {}
    total = 0
    # Iterate with a limit rather than reading an unbounded member list first.
    for entry in archive:
        name = entry.name.rstrip('/') if entry.isdir() else entry.name
        safe_name(name)
        if name in members or len(members) >= MAX_FILES:
            raise ValueError('Duplikat atau terlalu banyak file dalam paket.')
        if not entry.isfile() and not entry.isdir():
            raise ValueError('Paket tidak boleh memiliki symlink/hardlink/perangkat.')
        if name != 'manifest.json' and name != 'browser' and not name.startswith('browser/'):
            raise ValueError('Isi paket di luar frontend browser.')
        total += entry.size
        if total > MAX_BYTES or entry.size < 0:
            raise ValueError('Ukuran paket terlalu besar.')
        members[name] = entry
    metadata = members.get('manifest.json')
    if not metadata or not metadata.isfile() or metadata.size > 2 * 1024 * 1024:
        raise ValueError('Manifest paket tidak valid.')
    manifest = json.load(archive.extractfile(metadata))
    if manifest.get('version') != 1 or manifest.get('sourceTree') != tree:
        raise ValueError('Paket frontend berbeda dengan kode server. Build ulang npm run preparefe di laptop, lalu commit dan push paket terbaru ke GitHub.')
    files = manifest.get('files')
    if not isinstance(files, dict) or not files or 'index.html' not in files:
        raise ValueError('Manifest harus memuat index.html.')
    actual = {name[8:] for name, entry in members.items() if name.startswith('browser/') and entry.isfile()}
    if actual != set(files):
        raise ValueError('Daftar file paket tidak cocok dengan manifest.')
    for name, expected in files.items():
        safe_name(name)
        if not isinstance(expected, str) or not re.fullmatch('[0-9a-f]{64}', expected):
            raise ValueError('Checksum manifest tidak valid.')
        digest = hashlib.sha256()
        with archive.extractfile(members['browser/' + name]) as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise ValueError('Checksum file frontend gagal: ' + name)
    return files, members


def deploy(root, check_only=False):
    root = Path(root).resolve()
    artifact = root / 'releases/frontend.tar.gz'
    if not artifact.is_file():
        raise ValueError('Paket releases/frontend.tar.gz wajib tersedia. Jalankan npm run preparefe di laptop, commit dan push paket ke GitHub, lalu git pull di server.')
    if artifact.stat().st_size > MAX_BYTES:
        raise ValueError('Ukuran arsip terlalu besar.')
    tree = source_tree(root)
    with tarfile.open(artifact, 'r:gz') as archive:
        files, members = validate(archive, tree)
        if check_only:
            print('[UNZANET] Paket frontend lokal valid; build frontend di server dilewati.')
            return
        destination = root / 'frontend/dist/frontend/browser'
        # Refuse existing symlinks, including parent directories and old files.
        for target in [destination, *(destination / name for name in files)]:
            for part in [target, *target.parents]:
                if part == root:
                    break
                if part.is_symlink():
                    raise ValueError('Tujuan frontend tidak boleh berupa symlink.')
        destination.mkdir(parents=True, exist_ok=True)
        for part in [destination, destination.parent, destination.parent.parent]:
            part.chmod(0o755)
        with tempfile.TemporaryDirectory(prefix='.frontend-', dir=destination.parent) as staging:
            staging = Path(staging)
            for name in files:
                target = staging / name
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(members['browser/' + name]) as source, target.open('wb') as output:
                    for chunk in iter(lambda: source.read(1024 * 1024), b''):
                        output.write(chunk)
                target.chmod(0o644)
            # Preserve older hashed chunks for browser tabs opened before deployment.
            for name in sorted(files, key=lambda name: name == 'index.html'):
                target = destination / name
                target.parent.mkdir(parents=True, exist_ok=True)
                for part in target.parent.relative_to(destination).parents:
                    (destination / part).chmod(0o755)
                target.parent.chmod(0o755)
                os.replace(staging / name, target)
    print('[UNZANET] Frontend hasil build laptop terpasang; tidak menjalankan Angular build di server.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        deploy(Path(__file__).resolve().parent.parent, args.check)
    except (ValueError, OSError, tarfile.TarError, subprocess.CalledProcessError, TypeError, AttributeError) as error:
        parser.exit(1, '[UNZANET] Paket frontend ditolak: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
