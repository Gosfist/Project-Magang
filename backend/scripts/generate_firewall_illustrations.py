"""Draw vector instructions for the guide, then rasterize with Poppler.

These are labeled illustrations based on the DigitalOcean documentation, not
screenshots of the user's account. The unmodified official screenshot is separate.
Run with the document runtime Python and pass its bundled pdftoppm executable.
"""
import argparse
from pathlib import Path
import subprocess
import tempfile

from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[2]
INK, MUTED, BLUE, LIGHT, BORDER = '#172B4D', '#53627B', '#0069FF', '#F4F7FC', '#D6DEEB'


def label(c, x, y, value, size=18, bold=False, color=INK):
    c.setFillColor(HexColor(color))
    c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
    c.drawString(x, y, value)


def box(c, x, y, w, h, fill='FFFFFF', border=BORDER):
    c.setFillColor(HexColor('#' + fill.lstrip('#')))
    c.setStrokeColor(HexColor(border))
    c.roundRect(x, y, w, h, 6, fill=1, stroke=1)


def button(c, x, y, w, value):
    box(c, x, y, w, 42, BLUE, BLUE)
    label(c, x + 15, y + 14, value, 17, True, '#FFFFFF')


def note(c, number, x, y, value):
    c.setFillColor(HexColor(BLUE))
    c.circle(x, y + 6, 15, fill=1, stroke=0)
    label(c, x - 5, y, str(number), 17, True, '#FFFFFF')
    label(c, x + 27, y, value, 18, True)


def header(c, title, subtitle):
    label(c, 28, 489, title, 25, True)
    label(c, 28, 458, subtitle, 16, color=MUTED)
    label(c, 28, 18, 'ILUSTRASI PANDUAN | Bukan tangkapan layar akun Anda', 12, color=MUTED)


def navigation(c):
    header(c, '1  Buka form firewall', 'Browser Windows: cloud.digitalocean.com')
    note(c, 1, 44, 410, 'Networking  >  Firewalls')
    box(c, 28, 225, 215, 150, LIGHT)
    label(c, 49, 341, 'MANAGE', 13, True, MUTED)
    label(c, 49, 306, 'Droplets', 19)
    label(c, 49, 268, 'Networking', 19, True, BLUE)
    box(c, 267, 225, 667, 150)
    label(c, 289, 340, 'Networking', 24, True)
    label(c, 289, 297, 'Domains     Floating IPs     Firewalls', 18)
    button(c, 701, 245, 205, 'Create Firewall')
    note(c, 2, 44, 175, 'Klik Create Firewall, lalu isi Name')
    label(c, 57, 116, 'Name', 17, True)
    box(c, 151, 95, 510, 43)
    label(c, 167, 109, 'unzanet-vps', 20)


def inbound(c):
    header(c, '2  Cocokkan empat aturan masuk', 'Inbound Rules = akses yang boleh masuk ke VPS')
    heads = [('Type', 48), ('Protocol', 310), ('Port Range', 465), ('Sources', 658)]
    box(c, 28, 362, 906, 54, LIGHT)
    for text, x in heads:
        label(c, x, 382, text, 18, True)
    rows = [('SSH', 'TCP', '22', 'All IPv4'), ('HTTP', 'TCP', '80', 'All IPv4'),
            ('HTTPS', 'TCP', '443', 'All IPv4'), ('Custom / TCP', 'TCP', '4443', 'All IPv4')]
    for index, values in enumerate(rows):
        y = 301 - index * 59
        box(c, 28, y, 906, 57, 'EAF2FF' if index == 3 else 'FFFFFF')
        for value, (_, x) in zip(values, heads):
            label(c, x, y + 20, value, 20, index == 3)
    note(c, 1, 44, 73, 'Tambahkan aturan satu per satu: Add inbound rule / New rule')


def custom(c):
    header(c, '3  Isi port VPN 4443', 'Gunakan aturan Custom dengan protocol TCP')
    box(c, 160, 65, 640, 360)
    label(c, 185, 384, 'Add inbound rule', 23, True)
    fields = [('Type / Protocol', 'Custom / TCP'), ('Port Range', '4443'),
              ('Sources', 'All IPv4'), ('Action (jika muncul)', 'Allow')]
    for index, (key, value) in enumerate(fields):
        y = 319 - index * 54
        label(c, 185, y + 4, key, 17, True)
        box(c, 428, y - 10, 345, 40, 'EAF2FF' if index == 1 else 'FFFFFF')
        label(c, 444, y + 4, value, 20, index == 1)
    button(c, 552, 80, 220, 'Add inbound rule')


def apply(c):
    header(c, '4  Pasang firewall ke VPS', 'Droplet = nama VPS Anda di DigitalOcean')
    label(c, 36, 402, 'Outbound Rules', 23, True)
    label(c, 36, 369, 'Biarkan aturan bawaan: All TCP, All UDP, dan ICMP.', 19)
    label(c, 36, 341, 'Destination: All IPv4 / All IPv6. Port: All ports.', 17, color=MUTED)
    note(c, 1, 44, 281, 'Cari bagian Apply to Droplets')
    box(c, 37, 203, 886, 50)
    label(c, 55, 220, 'Nama VPS Anda (contoh: unzanet-vps)', 20)
    note(c, 2, 44, 160, 'Klik hasil pencarian sampai VPS terpilih')
    button(c, 669, 79, 250, 'Create Firewall')
    note(c, 3, 44, 91, 'Klik Create Firewall')


def build(poppler, output):
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='unzanet-firewall-diagrams-') as temporary:
        for name, draw in [('digitalocean-firewall-menu', navigation),
                           ('digitalocean-firewall-inbound', inbound),
                           ('digitalocean-firewall-custom', custom),
                           ('digitalocean-firewall-apply', apply)]:
            pdf = Path(temporary) / (name + '.pdf')
            drawing = canvas.Canvas(str(pdf), pagesize=(960, 525))
            draw(drawing)
            drawing.showPage()
            drawing.save()
            subprocess.run([str(poppler), '-singlefile', '-scale-to', '1800', '-png',
                            str(pdf), str(output / name)], check=True)
            print(output / (name + '.png'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdftoppm', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'backend/docs/images')
    options = parser.parse_args()
    build(options.pdftoppm, options.output)
