#!/usr/bin/env bash
# Build once; production runs the binary without a Go compiler or Node.js process.
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GO_VERSION=1.27.3
GO_BIN="$(command -v go || true)"
if [[ -z "$GO_BIN" || "$("$GO_BIN" env GOVERSION)" != "go$GO_VERSION" ]]; then
  GO_BIN="/usr/local/lib/unzanet-go-$GO_VERSION/bin/go"
  if [[ ! -x "$GO_BIN" ]]; then
    [[ "$EUID" == 0 ]] || { printf 'Pasang Go %s lalu ulangi build bot.\n' "$GO_VERSION" >&2; exit 1; }
    case "$(uname -m)" in x86_64) GO_ARCH=amd64 ;; aarch64|arm64) GO_ARCH=arm64 ;; *) printf 'Arsitektur Go tidak didukung.\n' >&2; exit 1 ;; esac
    STAGING="$(mktemp -d)"
    curl --fail --silent --show-error --location --proto '=https' "https://go.dev/dl/go$GO_VERSION.linux-$GO_ARCH.tar.gz" -o "$STAGING/go.tar.gz"
    curl --fail --silent --show-error --location --proto '=https' 'https://go.dev/dl/?mode=json&include=all' -o "$STAGING/releases.json"
    python3 - "$STAGING" "$GO_VERSION" "$GO_ARCH" <<'PY'
import hashlib, json, pathlib, sys
directory, version, arch = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
filename = f'go{version}.linux-{arch}.tar.gz'
files = [f for r in json.loads((directory / 'releases.json').read_text()) for f in r['files'] if f['filename'] == filename]
if len(files) != 1 or hashlib.file_digest((directory / 'go.tar.gz').open('rb'), 'sha256').hexdigest() != files[0]['sha256']:
    raise SystemExit('Checksum compiler Go tidak sesuai; build dibatalkan.')
PY
    tar -xzf "$STAGING/go.tar.gz" -C "$STAGING"
    install -d /usr/local/lib
    mv "$STAGING/go" "/usr/local/lib/unzanet-go-$GO_VERSION"
    # Keep the small download staging directory on failure for diagnostics.
    rm -f "$STAGING/go.tar.gz" "$STAGING/releases.json"
    rmdir "$STAGING"
  fi
fi
cd "$ROOT_DIR/bot_whatsapp"
umask 022
mkdir -p bin
# Serial compilation reduces peak build memory on the VPS.
CGO_ENABLED=0 "$GO_BIN" build -mod=readonly -p 1 -trimpath -ldflags='-s -w' -o bin/bot-whatsapp.next .
chmod 0755 bin/bot-whatsapp.next
mv -f bin/bot-whatsapp.next bin/bot-whatsapp
printf 'Bot Go + whatsmeow berhasil dibuild.\n'
