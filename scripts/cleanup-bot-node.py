"""Remove obsolete bot dependencies only after the Go service is healthy."""
import argparse
from pathlib import Path
import shutil


def cleanup(root):
    bot = root.resolve() / 'bot_whatsapp'
    if bot.is_symlink() or not bot.is_dir():
        raise ValueError('Folder bot harus direktori project, bukan symlink.')
    dependencies = bot / 'node_modules'
    if dependencies.is_symlink():
        raise ValueError('node_modules bot berupa symlink; tidak dihapus otomatis.')
    if dependencies.exists():
        if dependencies.resolve().parent != bot.resolve():
            raise ValueError('Lokasi dependency bot berada di luar folder bot.')
        shutil.rmtree(dependencies)
    source = bot / 'src'
    if source.is_dir() and not source.is_symlink():
        for directory in (source / 'middleware', source / 'routes', source):
            if not directory.is_symlink():
                try:
                    directory.rmdir()
                except OSError:
                    pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    args = parser.parse_args()
    cleanup(args.root)
    print('Dependency Node.js bot lama dibersihkan; backend dan sesi WA dipertahankan.')
