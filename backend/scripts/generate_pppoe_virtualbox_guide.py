from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


OUTPUT = Path(__file__).resolve().parents[1] / "docs" / "Panduan_Setup_Lab_PPPoE_VirtualBox_v1.1_WireGuard.docx"

NAVY = "0F172A"
BLUE = "2563EB"
LIGHT_BLUE = "DBEAFE"
LIGHT_GRAY = "F1F5F9"
MID_GRAY = "64748B"
GREEN = "DCFCE7"
AMBER = "FEF3C7"
RED = "FEE2E2"
WHITE = "FFFFFF"


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    fld_char_1 = OxmlElement("w:fldChar")
    fld_char_1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = " PAGE "
    fld_char_2 = OxmlElement("w:fldChar")
    fld_char_2.set(qn("w:fldCharType"), "end")
    run._r.extend([fld_char_1, instr_text, fld_char_2])


def add_hyperlink(paragraph, text, url):
    part = paragraph.part
    rel_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), rel_id)
    new_run = OxmlElement("w:r")
    run_properties = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), BLUE)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    run_properties.extend([color, underline])
    new_run.append(run_properties)
    text_node = OxmlElement("w:t")
    text_node.text = text
    new_run.append(text_node)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def add_heading(doc, text, level=1):
    paragraph = doc.add_heading(text, level=level)
    paragraph.paragraph_format.keep_with_next = True
    return paragraph


def add_body(doc, text="", bold_prefix=None):
    paragraph = doc.add_paragraph()
    paragraph.style = doc.styles["Body Text"]
    if bold_prefix and text.startswith(bold_prefix):
        paragraph.add_run(bold_prefix).bold = True
        paragraph.add_run(text[len(bold_prefix):])
    else:
        paragraph.add_run(text)
    return paragraph


def add_bullets(doc, items, level=0):
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
        paragraph.add_run(item)


def add_steps(doc, items):
    for item in items:
        paragraph = doc.add_paragraph(style="List Number")
        paragraph.add_run(item)


def add_code(doc, code):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    cell = table.cell(0, 0)
    shade(cell, NAVY)
    set_cell_margins(cell, 120, 160, 120, 160)
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(0)
    for index, line in enumerate(code.strip("\n").splitlines()):
        if index:
            paragraph.add_run().add_break()
        run = paragraph.add_run(line)
        run.font.name = "Consolas"
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor.from_string(WHITE)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_note(doc, title, text, color=LIGHT_BLUE):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    shade(cell, color)
    set_cell_margins(cell, 120, 160, 120, 160)
    paragraph = cell.paragraphs[0]
    run = paragraph.add_run(f"{title}: ")
    run.bold = True
    paragraph.add_run(text)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    header = table.rows[0]
    set_repeat_table_header(header)
    for index, value in enumerate(headers):
        cell = header.cells[index]
        shade(cell, NAVY)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        run = cell.paragraphs[0].add_run(value)
        run.bold = True
        run.font.color.rgb = RGBColor.from_string(WHITE)
        set_cell_margins(cell)
        if widths:
            cell.width = widths[index]
    for row_index, row_data in enumerate(rows):
        row = table.add_row()
        for index, value in enumerate(row_data):
            cell = row.cells[index]
            if row_index % 2:
                shade(cell, LIGHT_GRAY)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            paragraph = cell.paragraphs[0]
            paragraph.add_run(str(value))
            set_cell_margins(cell)
            if widths:
                cell.width = widths[index]
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


def configure_document(doc):
    section = doc.sections[0]
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.7)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)

    normal = doc.styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor.from_string(NAVY)

    body = doc.styles["Body Text"]
    body.font.name = "Aptos"
    body.font.size = Pt(10)
    body.font.color.rgb = RGBColor.from_string(NAVY)
    body.paragraph_format.space_after = Pt(6)
    body.paragraph_format.line_spacing = 1.08

    for level, size, color in ((1, 18, NAVY), (2, 14, BLUE), (3, 11, NAVY)):
        style = doc.styles[f"Heading {level}"]
        style.font.name = "Aptos Display"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.space_before = Pt(12)
        style.paragraph_format.space_after = Pt(6)

    for section in doc.sections:
        footer = section.footer.paragraphs[0]
        add_page_number(footer)


def build_document():
    doc = Document()
    configure_document(doc)

    # Cover
    doc.add_paragraph().paragraph_format.space_after = Pt(36)
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("PANDUAN LENGKAP\nLAB PPPoE + FREERADIUS")
    run.bold = True
    run.font.name = "Aptos Display"
    run.font.size = Pt(28)
    run.font.color.rgb = RGBColor.from_string(NAVY)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run("VirtualBox • Ubuntu/VPS • WireGuard • FreeRADIUS • CHR1 • CHR2")
    run.font.size = Pt(14)
    run.font.color.rgb = RGBColor.from_string(BLUE)

    doc.add_paragraph().paragraph_format.space_after = Pt(28)
    cover_table = doc.add_table(rows=4, cols=2)
    cover_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cover_table.style = "Table Grid"
    cover_rows = [
        ("Proyek", "PT Unzanet – Project Magang"),
        ("Repository", "github.com/Gosfist/Project-Magang"),
        ("Branch", "pppoe"),
        ("Versi panduan", "1.1 • 7 September 2026"),
    ]
    for i, values in enumerate(cover_rows):
        for j, value in enumerate(values):
            cell = cover_table.cell(i, j)
            shade(cell, LIGHT_BLUE if j == 0 else WHITE)
            set_cell_margins(cell, 150, 180, 150, 180)
            run = cell.paragraphs[0].add_run(value)
            run.bold = j == 0

    doc.add_paragraph().paragraph_format.space_after = Pt(28)
    goal = doc.add_paragraph()
    goal.alignment = WD_ALIGN_PARAGRAPH.CENTER
    goal.add_run(
        "Target akhir: akun dibuat melalui Laravel, CHR2 login PPPoE ke CHR1, "
        "FreeRADIUS memvalidasi akun dari MySQL, dan CHR2 dapat mengakses internet."
    ).italic = True

    doc.add_page_break()

    add_heading(doc, "Cara menggunakan panduan", 1)
    add_body(doc, "Ikuti bab secara berurutan. Jangan melanjutkan jika kotak verifikasi pada akhir tahap belum berhasil.")
    add_bullets(doc, [
        "Perintah bertanda Ubuntu dijalankan pada terminal Ubuntu.",
        "Perintah bertanda RouterOS dijalankan pada terminal CHR melalui console VirtualBox atau WinBox.",
        "Teks seperti GANTI_PASSWORD adalah placeholder dan wajib diganti.",
        "Nama interface dapat berbeda. Selalu cocokkan dengan hasil pemeriksaan interface sebelum menempel perintah.",
        "Dokumen memakai Ubuntu Server 24.04/26.04 LTS, RouterOS 7, dan VirtualBox 7.x.",
    ])
    add_note(doc, "Peringatan", "Jangan memakai password contoh dan RADIUS secret dari dokumen pada VPS atau perangkat produksi.", AMBER)

    add_heading(doc, "Daftar isi", 1)
    toc_items = [
        "1. Hasil akhir dan konsep aliran data",
        "2. Rencana alamat IP dan adapter",
        "3. Membuat jaringan VirtualBox",
        "4. Membuat VM Ubuntu",
        "5. Membuat VM CHR1 dan CHR2",
        "6. Menyiapkan Ubuntu dan alamat management",
        "7. Deploy Laravel dari GitHub",
        "8. Menyiapkan MySQL",
        "9. Menjalankan migration dan membuat admin",
        "10. Menyiapkan Nginx dan PHP-FPM",
        "11. Menyiapkan FreeRADIUS + MySQL",
        "12. Konfigurasi CHR1 sebagai PPPoE server",
        "13. Membuat paket dan akun dari Laravel",
        "14. Konfigurasi CHR2 sebagai modem PPPoE",
        "15. Pengujian end-to-end",
        "16. Troubleshooting",
        "17. Snapshot, backup, dan perpindahan ke VPS/perangkat fisik",
        "18. WireGuard aman antara VPS dan MikroTik",
        "19. Checklist keberhasilan dan referensi",
    ]
    add_bullets(doc, toc_items)

    doc.add_page_break()
    add_heading(doc, "1. Hasil akhir dan konsep aliran data", 1)
    add_body(doc, "Laravel bukan server PPPoE. Laravel adalah panel pengelolaan akun dan paket. Proses autentikasi tetap dilakukan FreeRADIUS, sedangkan sesi PPPoE dan trafik internet diproses CHR1.")

    add_table(doc, ["Komponen", "Peran utama", "Tidak melakukan"], [
        ("Ubuntu", "Laravel, Nginx, MySQL, FreeRADIUS", "Tidak meneruskan trafik pelanggan"),
        ("CHR1", "Gateway internet, PPPoE server, RADIUS client, NAT", "Tidak menyimpan akun pelanggan sebagai /ppp secret"),
        ("CHR2", "PPPoE client dan router/modem pelanggan", "Tidak mengakses MySQL secara langsung"),
        ("MySQL", "Menyimpan paket, akun, radcheck, radreply, radacct", "Tidak mengautentikasi RADIUS sendiri"),
    ])

    add_heading(doc, "Alur login", 2)
    add_steps(doc, [
        "CHR2 mengirim username dan password PPPoE ke CHR1 melalui jaringan PPPOE-LAB.",
        "CHR1 mengirim Access-Request ke FreeRADIUS pada Ubuntu 192.168.56.10.",
        "FreeRADIUS membaca radcheck dan radreply pada database unzanet.",
        "FreeRADIUS mengirim Access-Accept beserta Framed-Pool dan Mikrotik-Rate-Limit.",
        "CHR1 memberi alamat IP dari pool, membuat sesi PPP, dan meneruskan trafik ke internet melalui NAT.",
        "Accounting Start/Interim/Stop dicatat FreeRADIUS ke radacct.",
    ])
    add_note(doc, "Batas CHR gratis", "Lisensi CHR Free dibatasi 1 Mbps upload per interface. Ini cukup untuk menguji login dan konektivitas, tetapi hasil speed test tidak mewakili paket 10/20/50 Mbps.", AMBER)

    add_heading(doc, "2. Rencana alamat IP dan adapter", 1)
    add_table(doc, ["Jaringan", "Subnet/nama", "Fungsi"], [
        ("NAT VirtualBox", "DHCP otomatis", "Internet Ubuntu dan WAN CHR1"),
        ("Host-only", "LAB-MGMT – 192.168.56.0/24", "Web, SSH, WinBox, dan RADIUS"),
        ("Internal Network", "PPPOE-LAB", "Kabel virtual antara server dan modem"),
        ("Internal Network", "CLIENT-LAN", "LAN opsional di belakang CHR2"),
        ("WireGuard produksi", "10.99.0.0/30", "RADIUS terenkripsi antara VPS dan MikroTik"),
        ("Pool PPPoE", "10.20.0.2–10.20.0.254", "Alamat yang diterima CHR2"),
    ])
    add_table(doc, ["Mesin", "Adapter 1", "Adapter 2", "Adapter 3", "IP management"], [
        ("Ubuntu", "NAT", "Host-only LAB-MGMT", "—", "192.168.56.10/24"),
        ("CHR1", "NAT / WAN", "Host-only LAB-MGMT", "Internal PPPOE-LAB", "192.168.56.11/24"),
        ("CHR2", "Host-only LAB-MGMT", "Internal PPPOE-LAB", "Internal CLIENT-LAN", "192.168.56.12/24"),
    ])
    add_note(doc, "Penting", "Nomor ether pada CHR mengikuti urutan Adapter VirtualBox. Jika urutannya berbeda, sesuaikan semua perintah.")

    add_heading(doc, "3. Membuat jaringan VirtualBox", 1)
    add_heading(doc, "3.1 Host-only LAB-MGMT", 2)
    add_steps(doc, [
        "Buka VirtualBox Manager.",
        "Masuk ke Tools → Network atau File → Tools → Network Manager, tergantung versi VirtualBox.",
        "Buka tab Host-only Networks lalu klik Create.",
        "Atur IPv4 Address menjadi 192.168.56.1 dan mask 255.255.255.0.",
        "Matikan DHCP Server karena setiap VM akan memakai IP statis.",
        "Catat nama adapter host-only yang muncul. Pada Windows biasanya bernama VirtualBox Host-Only Ethernet Adapter.",
    ])
    add_heading(doc, "3.2 Internal Network", 2)
    add_body(doc, "Internal Network tidak perlu dibuat dari menu terpisah. Nama jaringan muncul saat adapter VM disetel ke Internal Network. Ketik nama dengan ejaan yang sama persis: PPPOE-LAB dan CLIENT-LAN.")

    add_heading(doc, "4. Membuat VM Ubuntu", 1)
    add_steps(doc, [
        "Klik New dan beri nama UBUNTU-RADIUS-WEB.",
        "Pilih ISO Ubuntu Server yang sudah diunduh.",
        "Alokasikan minimal 2 CPU, RAM 4 GB, dan disk 30 GB dynamically allocated.",
        "Buka Settings → Network.",
        "Adapter 1: Enable, Attached to NAT, Cable Connected aktif.",
        "Adapter 2: Enable, Attached to Host-only Adapter, pilih adapter LAB-MGMT, Cable Connected aktif.",
        "Mulai VM dan ikuti installer Ubuntu. Gunakan entire disk karena ini VM lab.",
        "Buat hostname ubuntu-radius dan user administrator non-root.",
        "Centang Install OpenSSH Server agar Ubuntu dapat dikelola dari Windows.",
        "Setelah instalasi selesai, reboot dan lepas ISO jika diminta.",
    ])
    add_note(doc, "Ubuntu terbaru", "Dokumentasi Ubuntu saat panduan dibuat menampilkan Ubuntu 26.04 LTS sebagai LTS terbaru. Perintah juga dibuat kompatibel dengan Ubuntu 24.04 LTS.")

    add_heading(doc, "5. Membuat VM CHR1 dan CHR2", 1)
    add_heading(doc, "5.1 Menyiapkan dua disk VDI unik", 2)
    add_body(doc, "Jangan memasang file VDI yang sama langsung ke dua VM karena VirtualBox dapat menolak UUID disk yang sama. Gunakan menu Media → Copy atau VBoxManage clonemedium untuk membuat dua salinan.")
    add_code(doc, r'''cd "C:\Program Files\Oracle\VirtualBox"
VBoxManage clonemedium disk "D:\VM\chr.vdi" "D:\VM\chr1.vdi" --format VDI
VBoxManage clonemedium disk "D:\VM\chr.vdi" "D:\VM\chr2.vdi" --format VDI''')
    add_body(doc, "Ganti lokasi D:\\VM\\chr.vdi sesuai lokasi file CHR milik Anda.")

    add_heading(doc, "5.2 VM CHR1", 2)
    add_steps(doc, [
        "Klik New, nama CHR1-PPPOE-SERVER, Type Linux, Version Other Linux (64-bit).",
        "Pilih Use an Existing Virtual Hard Disk File dan gunakan chr1.vdi.",
        "Alokasikan 1 CPU dan RAM 1024 MB.",
        "Adapter 1: NAT.",
        "Adapter 2: Host-only Adapter LAB-MGMT.",
        "Adapter 3: Internal Network dengan nama PPPOE-LAB.",
        "Untuk ketiga adapter, gunakan Intel PRO/1000 MT Desktop dan aktifkan Cable Connected.",
    ])

    add_heading(doc, "5.3 VM CHR2", 2)
    add_steps(doc, [
        "Klik New, nama CHR2-MODEM, Type Linux, Version Other Linux (64-bit).",
        "Gunakan chr2.vdi, 1 CPU, dan RAM 512–1024 MB.",
        "Adapter 1: Host-only Adapter LAB-MGMT.",
        "Adapter 2: Internal Network PPPOE-LAB.",
        "Adapter 3: Internal Network CLIENT-LAN.",
        "Gunakan tipe adapter yang sama dan aktifkan Cable Connected.",
    ])
    add_heading(doc, "5.4 Login awal", 2)
    add_body(doc, "Jalankan masing-masing CHR. Login awal RouterOS adalah admin dengan password kosong. Saat diminta, buat password baru yang kuat.")
    add_code(doc, '''/system identity set name=CHR1-PPPOE-SERVER
/user set admin password=GANTI_PASSWORD_ADMIN_CHR1
/interface ethernet print''')
    add_body(doc, "Pada CHR2, gunakan nama CHR2-MODEM dan password yang berbeda. Pastikan jumlah interface dan urutannya benar sebelum lanjut.")

    add_heading(doc, "6. Menyiapkan Ubuntu dan alamat management", 1)
    add_heading(doc, "6.1 Periksa interface", 2)
    add_code(doc, "ip -br address\nip route")
    add_body(doc, "Biasanya Adapter 1 adalah enp0s3 dan Adapter 2 adalah enp0s8. Gunakan nama yang benar dari hasil perintah, jangan menebak.")

    add_heading(doc, "6.2 Atur IP statis", 2)
    add_body(doc, "Edit file Netplan yang sudah ada pada /etc/netplan/. Nama file dapat berbeda.")
    add_code(doc, "ls /etc/netplan\nsudo nano /etc/netplan/50-cloud-init.yaml")
    add_code(doc, '''network:
  version: 2
  ethernets:
    enp0s3:
      dhcp4: true
    enp0s8:
      dhcp4: false
      addresses:
        - 192.168.56.10/24''')
    add_note(doc, "YAML", "Gunakan spasi, bukan Tab. Sesuaikan enp0s3/enp0s8 dengan hasil ip -br address.", AMBER)
    add_code(doc, "sudo netplan try\nsudo netplan apply\nip -br address\nping -c 4 8.8.8.8\nping -c 4 github.com")
    add_body(doc, "Dari PowerShell Windows, uji ping 192.168.56.10. Jika ping diblokir, lanjutkan tes SSH atau web setelah service dipasang.")

    add_heading(doc, "6.3 Update dan install paket", 2)
    add_code(doc, '''sudo apt update
sudo apt full-upgrade -y
sudo apt install -y nginx mysql-server git unzip curl composer \
  php-fpm php-cli php-mysql php-mbstring php-xml php-curl php-zip php-bcmath php-intl \
  freeradius freeradius-mysql freeradius-utils nodejs npm ufw''')
    add_code(doc, "php -v\ncomposer --version\nnode -v\nnpm -v\nfreeradius -v")
    add_note(doc, "Versi Node", "Proyek memakai Vite 8. Node harus minimal 20.19 atau 22.12. Jika paket Ubuntu menghasilkan versi lebih rendah, pasang Node LTS terbaru dari distribusi resmi Node.js sebelum menjalankan npm ci.", AMBER)

    add_heading(doc, "7. Deploy Laravel dari GitHub", 1)
    add_heading(doc, "7.1 Clone branch PPPoE", 2)
    add_code(doc, '''sudo mkdir -p /var/www
sudo chown "$USER":www-data /var/www
git clone --branch pppoe https://github.com/Gosfist/Project-Magang.git /var/www/unzanet
cd /var/www/unzanet
git status
git log -1 --oneline''')
    add_note(doc, "Repository private", "Jika GitHub meminta autentikasi, gunakan SSH key atau Personal Access Token. Jangan menaruh token di dokumen, .env, atau repository.")

    add_heading(doc, "7.2 Siapkan dependency dan .env", 2)
    add_code(doc, '''cd /var/www/unzanet
cp .env.example .env
composer install --no-dev --optimize-autoloader
npm ci
npm run build
php artisan key:generate''')
    add_body(doc, "Buat JWT secret dengan perintah berikut, lalu salin hasilnya ke JWT_SECRET pada .env.")
    add_code(doc, "openssl rand -hex 32\nsudo nano /var/www/unzanet/.env")
    add_code(doc, '''APP_NAME="Unzanet"
APP_ENV=production
APP_KEY=nilai_yang_dibuat_artisan
APP_DEBUG=false
APP_URL=http://192.168.56.10

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=unzanet
DB_USERNAME=unzanet_app
DB_PASSWORD=GANTI_PASSWORD_DB_APLIKASI

SESSION_DRIVER=database
SESSION_LIFETIME=10080
CACHE_STORE=database
QUEUE_CONNECTION=database

JWT_SECRET=HASIL_OPENSSL_RANDOM
JWT_TTL=10080''')

    add_heading(doc, "8. Menyiapkan MySQL", 1)
    add_heading(doc, "8.1 Buat database dan user", 2)
    add_code(doc, "sudo mysql")
    add_code(doc, '''CREATE DATABASE unzanet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'unzanet_app'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_DB_APLIKASI';
GRANT ALL PRIVILEGES ON unzanet.* TO 'unzanet_app'@'localhost';

CREATE USER 'radius'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_DB_RADIUS';
FLUSH PRIVILEGES;
EXIT;''')
    add_note(doc, "Keamanan", "MySQL tetap bind ke localhost. Laravel dan FreeRADIUS berada di Ubuntu yang sama, jadi port 3306 tidak perlu dibuka ke jaringan.", GREEN)

    add_heading(doc, "8.2 Uji login database aplikasi", 2)
    add_code(doc, "mysql -u unzanet_app -p -h 127.0.0.1 -e \"SELECT VERSION();\"")

    add_heading(doc, "9. Menjalankan migration dan membuat admin", 1)
    add_heading(doc, "9.1 Migration", 2)
    add_code(doc, '''cd /var/www/unzanet
php artisan config:clear
php artisan migrate --force
php artisan migrate:status''')
    add_body(doc, "Migration proyek membuat tabel aplikasi sekaligus tabel FreeRADIUS seperti radcheck, radreply, radacct, radpostauth, radusergroup, dan nas.")

    add_heading(doc, "9.2 Berikan izin minimum untuk user FreeRADIUS", 2)
    add_code(doc, "sudo mysql")
    add_code(doc, '''GRANT SELECT ON unzanet.radcheck TO 'radius'@'localhost';
GRANT SELECT ON unzanet.radreply TO 'radius'@'localhost';
GRANT SELECT ON unzanet.radgroupcheck TO 'radius'@'localhost';
GRANT SELECT ON unzanet.radgroupreply TO 'radius'@'localhost';
GRANT SELECT ON unzanet.radusergroup TO 'radius'@'localhost';
GRANT SELECT ON unzanet.nas TO 'radius'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unzanet.radacct TO 'radius'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unzanet.radpostauth TO 'radius'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unzanet.nasreload TO 'radius'@'localhost';
FLUSH PRIVILEGES;
EXIT;''')

    add_heading(doc, "9.3 Buat admin dashboard", 2)
    add_note(doc, "Jangan menjalankan seeder produksi", "Seeder repository berisi akun demo. Untuk server baru, buat admin manual dengan password kuat.", RED)
    add_code(doc, '''cd /var/www/unzanet
php artisan tinker''')
    add_code(doc, r'''App\Models\User::create([
    'name' => 'Administrator',
    'email' => 'admin@domain-anda.test',
    'password' => 'GANTI_PASSWORD_ADMIN_WEB_YANG_KUAT',
    'role' => 'admin',
    'status' => 'active',
]);
exit''')
    add_body(doc, "Model User melakukan hashing password secara otomatis.")

    add_heading(doc, "9.4 Permission dan optimasi Laravel", 2)
    add_code(doc, '''sudo chown -R www-data:www-data /var/www/unzanet/storage /var/www/unzanet/bootstrap/cache
sudo chmod -R 775 /var/www/unzanet/storage /var/www/unzanet/bootstrap/cache
cd /var/www/unzanet
php artisan storage:link
php artisan optimize
php artisan about
php artisan route:list --path=dashboard/pppoe
composer check-platform-reqs''')

    add_heading(doc, "10. Menyiapkan Nginx dan PHP-FPM", 1)
    add_heading(doc, "10.1 Cari socket PHP", 2)
    add_code(doc, "ls -l /run/php/*-fpm.sock\nsystemctl list-units --type=service | grep php")
    add_body(doc, "Catat socket yang muncul, misalnya /run/php/php8.4-fpm.sock. Gunakan nilai sebenarnya pada fastcgi_pass.")

    add_heading(doc, "10.2 Server block Laravel", 2)
    add_code(doc, "sudo nano /etc/nginx/sites-available/unzanet")
    add_code(doc, r'''server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/unzanet/public;
    index index.php;
    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.X-fpm.sock;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}''')
    add_note(doc, "Wajib", "Ganti php8.X-fpm.sock dengan socket hasil pemeriksaan. Root Nginx harus menunjuk ke /var/www/unzanet/public, bukan root repository.", AMBER)
    add_code(doc, '''sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/unzanet /etc/nginx/sites-enabled/unzanet
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx''')

    add_heading(doc, "10.3 Firewall Ubuntu", 2)
    add_code(doc, '''sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.56.0/24 to any port 22 proto tcp
sudo ufw allow from 192.168.56.0/24 to any port 80 proto tcp
sudo ufw allow from 192.168.56.11 to any port 1812 proto udp
sudo ufw allow from 192.168.56.11 to any port 1813 proto udp
sudo ufw enable
sudo ufw status numbered''')
    add_body(doc, "Buka http://192.168.56.10 dari browser Windows dan login menggunakan admin yang baru dibuat.")

    add_heading(doc, "11. Menyiapkan FreeRADIUS + MySQL", 1)
    add_heading(doc, "11.1 Konfigurasi modul SQL", 2)
    add_body(doc, "Pada paket Ubuntu FreeRADIUS 3, konfigurasi biasanya berada di /etc/freeradius/3.0. Konfirmasi dengan ls /etc/freeradius jika berbeda.")
    add_code(doc, "sudo nano /etc/freeradius/3.0/mods-available/sql")
    add_body(doc, "Cari dan sesuaikan parameter berikut. Jangan menghapus isi lain dari file.")
    add_code(doc, '''dialect = "mysql"
driver = "rlm_sql_${dialect}"
server = "localhost"
port = 3306
login = "radius"
password = "GANTI_PASSWORD_DB_RADIUS"
radius_db = "unzanet"''')
    add_code(doc, '''sudo ln -s /etc/freeradius/3.0/mods-available/sql \
  /etc/freeradius/3.0/mods-enabled/sql 2>/dev/null || true''')

    add_heading(doc, "11.2 Aktifkan SQL pada virtual server", 2)
    add_body(doc, "Edit /etc/freeradius/3.0/sites-enabled/default. Pastikan pemanggilan sql aktif pada bagian berikut; cukup aktifkan baris yang sudah tersedia.")
    add_bullets(doc, [
        "authorize { ... sql ... pap ... } untuk membaca radcheck/radreply.",
        "accounting { ... sql ... } untuk menyimpan sesi ke radacct.",
        "session { ... sql ... } untuk pemeriksaan Simultaneous-Use = 1.",
        "post-auth { ... sql ... } untuk mencatat hasil autentikasi.",
    ])
    add_note(doc, "Jangan overwrite", "Edit blok yang sudah ada. Jangan mengganti seluruh file default dengan potongan di atas karena modul lain tetap dibutuhkan.", RED)

    add_heading(doc, "11.3 Daftarkan CHR1 sebagai RADIUS client", 2)
    add_code(doc, "sudo nano /etc/freeradius/3.0/clients.conf")
    add_code(doc, '''client chr1-pppoe {
    ipaddr = 192.168.56.11
    secret = GANTI_RADIUS_SECRET_PANJANG
    shortname = chr1-pppoe
    nas_type = mikrotik
}''')
    add_body(doc, "Secret ini harus sama persis dengan secret pada perintah /radius add di CHR1.")

    add_heading(doc, "11.4 Validasi service", 2)
    add_code(doc, '''sudo freeradius -XC
sudo systemctl restart freeradius
sudo systemctl enable freeradius
sudo systemctl status freeradius --no-pager
sudo ss -lunp | grep -E ':1812|:1813' ''')
    add_note(doc, "Jika -XC gagal", "Jangan lanjut. Baca baris error pertama, perbaiki file dan nomor baris tersebut, lalu ulangi freeradius -XC.", AMBER)

    add_heading(doc, "12. Konfigurasi CHR1 sebagai PPPoE server", 1)
    add_heading(doc, "12.1 Identifikasi interface", 2)
    add_code(doc, "/interface ethernet print\n/ip address print\n/ip route print")
    add_body(doc, "Dengan urutan adapter panduan: ether1 = NAT/WAN, ether2 = management, ether3 = PPPoE access.")

    add_heading(doc, "12.2 WAN, management, DNS, dan NAT", 2)
    add_code(doc, '''/system identity set name=CHR1-PPPOE-SERVER
/ip dhcp-client add interface=ether1 add-default-route=yes use-peer-dns=no disabled=no
/ip address add address=192.168.56.11/24 interface=ether2 comment=LAB-MGMT
/ip dns set servers=1.1.1.1,8.8.8.8 allow-remote-requests=yes
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="Internet PPPoE Lab"''')
    add_code(doc, "/ping 192.168.56.10 count=4\n/ping 8.8.8.8 count=4\n/ping google.com count=4")

    add_heading(doc, "12.3 Pool, profile, dan PPPoE server", 2)
    add_code(doc, '''/ip pool add name=pool-pppoe ranges=10.20.0.2-10.20.0.254
/ppp profile add name=profile-pppoe local-address=10.20.0.1 \
  remote-address=pool-pppoe dns-server=1.1.1.1,8.8.8.8
/interface pppoe-server server add name=pppoe-server1 interface=ether3 \
  service-name=UNZANET default-profile=profile-pppoe \
  authentication=pap,chap,mschap1,mschap2 one-session-per-host=yes disabled=no''')
    add_note(doc, "Tanpa local secret", "Jangan membuat username pelanggan yang sama pada /ppp secret. RouterOS memeriksa user lokal sebelum RADIUS.", AMBER)

    add_heading(doc, "12.4 Hubungkan CHR1 ke FreeRADIUS", 2)
    add_code(doc, '''/radius add service=ppp address=192.168.56.10 \
  secret=GANTI_RADIUS_SECRET_PANJANG src-address=192.168.56.11 \
  authentication-port=1812 accounting-port=1813 timeout=3s
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
/radius print detail
/radius monitor 0''')

    add_heading(doc, "13. Membuat paket dan akun dari Laravel", 1)
    add_heading(doc, "13.1 Paket PPPoE", 2)
    add_steps(doc, [
        "Buka http://192.168.56.10 dan login sebagai admin.",
        "Buka PPPoE → Daftar Paket → Tambah Paket.",
        "Nama Paket: LAB 10 MBPS.",
        "Harga: bebas untuk lab, misalnya 100000.",
        "Download: 10 Mbps; Upload: 5 Mbps.",
        "Nama IP Pool RouterOS: pool-pppoe. Nama ini harus sama persis dengan pool pada CHR1.",
        "Simpan. Paket baru otomatis aktif.",
    ])
    add_heading(doc, "13.2 Akun PPPoE", 2)
    add_steps(doc, [
        "Buka PPPoE → Akun PPPoE → Tambah Akun.",
        "Nama Pelanggan: Pelanggan Lab.",
        "Paket: LAB 10 MBPS.",
        "Username: pelanggan01.",
        "Password: gunakan password uji yang kuat dan catat sementara.",
        "Isi nomor telepon/alamat bila diperlukan, lalu Simpan.",
        "Akun baru otomatis aktif dan hanya mengizinkan satu sesi.",
    ])

    add_heading(doc, "13.3 Periksa data RADIUS", 2)
    add_code(doc, '''mysql -u unzanet_app -p unzanet -e \
"SELECT username,attribute,op,value FROM radcheck WHERE username='pelanggan01';"

mysql -u unzanet_app -p unzanet -e \
"SELECT username,attribute,op,value FROM radreply WHERE username='pelanggan01';"''')
    add_body(doc, "Harus terlihat Cleartext-Password dan Simultaneous-Use = 1 pada radcheck, serta Mikrotik-Rate-Limit dan Framed-Pool = pool-pppoe pada radreply.")

    add_heading(doc, "13.4 Tes lokal FreeRADIUS", 2)
    add_body(doc, "Gunakan secret localhost bawaan FreeRADIUS yang tertera pada clients.conf; pada instalasi standar biasanya testing123.")
    add_code(doc, "radtest pelanggan01 PASSWORD_AKUN 127.0.0.1 0 testing123")
    add_body(doc, "Target hasil adalah Access-Accept. Jika Access-Reject, jalankan debug:")
    add_code(doc, '''sudo systemctl stop freeradius
sudo freeradius -X''')
    add_body(doc, "Buka terminal SSH kedua, ulangi radtest, lalu baca alur SQL. Setelah selesai tekan Ctrl+C dan jalankan sudo systemctl start freeradius.")

    add_heading(doc, "14. Konfigurasi CHR2 sebagai modem PPPoE", 1)
    add_heading(doc, "14.1 Management", 2)
    add_code(doc, '''/system identity set name=CHR2-MODEM
/ip address add address=192.168.56.12/24 interface=ether1 comment=LAB-MGMT
/ip dns set servers=1.1.1.1,8.8.8.8 allow-remote-requests=yes
/ping 192.168.56.11 count=4''')

    add_heading(doc, "14.2 PPPoE client", 2)
    add_code(doc, '''/interface pppoe-client add name=pppoe-out1 interface=ether2 \
  service-name=UNZANET user=pelanggan01 password=PASSWORD_AKUN \
  add-default-route=yes use-peer-dns=yes disabled=no''')
    add_code(doc, '''/interface pppoe-client monitor pppoe-out1 once
/ip address print where interface=pppoe-out1
/ip route print where dst-address=0.0.0.0/0
/ping 10.20.0.1 count=4
/ping 8.8.8.8 count=4
/ping google.com count=4''')
    add_body(doc, "Status PPPoE harus connected dan CHR2 menerima alamat dari rentang 10.20.0.2–10.20.0.254.")

    add_heading(doc, "14.3 LAN di belakang modem", 2)
    add_code(doc, '''/ip address add address=192.168.88.1/24 interface=ether3 comment=CLIENT-LAN
/ip pool add name=client-lan-pool ranges=192.168.88.10-192.168.88.200
/ip dhcp-server add name=client-lan-dhcp interface=ether3 \
  address-pool=client-lan-pool lease-time=1h disabled=no
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 \
  dns-server=192.168.88.1
/ip firewall nat add chain=srcnat out-interface=pppoe-out1 action=masquerade \
  comment="NAT pelanggan"''')
    add_body(doc, "Untuk menguji perangkat di belakang modem, tambahkan VM client ke Internal Network CLIENT-LAN. VM tersebut harus mendapat IP 192.168.88.x dari CHR2 dan bisa mengakses internet.")

    add_heading(doc, "15. Pengujian end-to-end", 1)
    add_table(doc, ["Tahap", "Perintah/lokasi", "Hasil yang benar"], [
        ("Ubuntu internet", "ping github.com", "Reply diterima"),
        ("Web Laravel", "Browser → 192.168.56.10", "Halaman login tampil"),
        ("SQL RADIUS", "SELECT radcheck/radreply", "Akun dan atribut paket tampil"),
        ("FreeRADIUS lokal", "radtest", "Access-Accept"),
        ("CHR1 ke Ubuntu", "/ping 192.168.56.10", "Reply diterima"),
        ("RADIUS CHR1", "/radius monitor 0", "requests/accepts bertambah, timeout 0"),
        ("PPPoE CHR2", "monitor pppoe-out1", "status connected"),
        ("Internet CHR2", "/ping 8.8.8.8", "Reply diterima"),
        ("DNS CHR2", "/ping google.com", "Nama ter-resolve"),
        ("Accounting", "SELECT radacct", "Sesi pelanggan01 tercatat"),
    ])
    add_heading(doc, "Cek accounting", 2)
    add_code(doc, '''mysql -u unzanet_app -p unzanet -e \
"SELECT username,acctstarttime,acctstoptime,framedipaddress,nasipaddress \
 FROM radacct ORDER BY radacctid DESC LIMIT 10;"''')
    add_heading(doc, "Uji toggle paket", 2)
    add_steps(doc, [
        "Putuskan PPPoE CHR2.",
        "Pada Laravel, ubah toggle paket menjadi OFF.",
        "Aktifkan kembali PPPoE CHR2; login baru harus ditolak.",
        "Ubah toggle paket menjadi ON.",
        "Aktifkan PPPoE CHR2; login harus berhasil lagi.",
    ])
    add_note(doc, "Sesi aktif", "Toggle OFF menghapus otorisasi login baru. Sesi yang sudah terhubung dapat tetap aktif sampai diputus; pemutusan instan membutuhkan Disconnect Message/CoA yang belum termasuk tahap dasar ini.", AMBER)

    add_heading(doc, "16. Troubleshooting", 1)
    add_table(doc, ["Gejala", "Pemeriksaan", "Perbaikan"], [
        ("Ubuntu tidak internet", "ip route; ping 8.8.8.8", "Pastikan Adapter 1 Ubuntu = NAT dan DHCP aktif"),
        ("Web tidak terbuka", "nginx -t; systemctl status nginx", "Perbaiki socket PHP, root public, permission, dan UFW"),
        ("Laravel error 500", "storage/logs/laravel.log", "Periksa APP_KEY, .env, DB, permission storage/cache"),
        ("FreeRADIUS gagal start", "freeradius -XC", "Perbaiki file dan baris error pertama"),
        ("No such table radcheck", "php artisan migrate:status", "Jalankan migration pada database unzanet"),
        ("Access-Reject", "freeradius -X", "Cek username/password, SQL aktif, paket dan akun aktif"),
        ("Unknown client", "clients.conf", "IP client harus 192.168.56.11 dan secret sama"),
        ("RADIUS timeout", "/radius monitor 0; ufw status", "Cek IP source CHR1, UDP 1812/1813, adapter host-only"),
        ("bad-replies bertambah", "/radius monitor 0", "Shared secret CHR1 dan clients.conf tidak sama"),
        ("PPPoE terus dialing", "log print where topics~\"ppp\"", "Cek PPPOE-LAB, service-name, akun, dan RADIUS"),
        ("PPPoE connected tanpa internet", "route, NAT, ping bertahap", "Cek default route CHR1, NAT ether1, dan DNS"),
        ("Pool not found", "/ip pool print", "Nama Framed-Pool harus persis pool-pppoe di CHR1"),
        ("Kecepatan hanya sekitar 1 Mbps", "/system license print", "Ini batas lisensi CHR Free, bukan kesalahan paket"),
    ])

    add_heading(doc, "Perintah diagnosis Ubuntu", 2)
    add_code(doc, '''sudo systemctl status nginx mysql freeradius --no-pager
sudo journalctl -u freeradius -n 100 --no-pager
sudo tail -n 100 /var/www/unzanet/storage/logs/laravel.log
sudo ss -lntup
sudo ufw status numbered''')
    add_heading(doc, "Perintah diagnosis CHR1", 2)
    add_code(doc, '''/interface print
/ip address print
/ip route print
/ip firewall nat print
/radius print detail
/radius monitor 0
/ppp active print detail
/log print where topics~"radius|ppp"''')

    add_heading(doc, "17. Snapshot, backup, dan perpindahan", 1)
    add_heading(doc, "17.1 Snapshot VirtualBox", 2)
    add_steps(doc, [
        "Matikan VM dengan benar.",
        "Buat snapshot Ubuntu setelah Nginx, Laravel, MySQL, dan FreeRADIUS lulus pengujian.",
        "Buat snapshot CHR1 setelah RADIUS dan PPPoE server bekerja.",
        "Buat snapshot CHR2 setelah PPPoE client connected.",
        "Beri nama snapshot yang menjelaskan kondisi, misalnya 01-radius-sql-ok.",
    ])

    add_heading(doc, "17.2 Backup", 2)
    add_code(doc, '''mysqldump -u unzanet_app -p --single-transaction unzanet > unzanet-backup.sql
cd /var/www/unzanet
sudo tar -czf unzanet-env-storage-backup.tar.gz .env storage''')
    add_code(doc, '''/export file=chr1-config
/system backup save name=chr1-lab-backup''')
    add_body(doc, "Untuk pindah dari CHR virtual ke perangkat MikroTik fisik, gunakan export teks sebagai referensi lalu sesuaikan nama interface. Jangan memulihkan backup biner secara buta ke perangkat berbeda.")

    add_heading(doc, "17.3 Pindah Ubuntu ke VPS", 2)
    add_bullets(doc, [
        "Deploy repository dan restore database pada VPS.",
        "Salin APP_KEY lama agar password terenkripsi aplikasi tetap dapat dibaca.",
        "Ganti APP_URL, konfigurasi Nginx, DNS, dan TLS.",
        "Jangan membuka MySQL ke internet.",
        "Selesaikan konfigurasi WireGuard pada Bab 18 sebelum mengubah RADIUS MikroTik.",
        "Jangan membuka UDP 1812/1813 pada public firewall atau security group VPS.",
        "Uji RADIUS dengan satu akun sebelum memigrasikan pelanggan lain.",
    ])

    doc.add_page_break()
    add_heading(doc, "18. WireGuard aman antara VPS dan MikroTik", 1)
    add_body(doc, "Bab ini digunakan saat Ubuntu sudah berada di VPS dan MikroTik/CHR1 berada di lokasi pelanggan/ISP. WireGuard mengenkripsi jalur management RADIUS melalui internet publik. Trafik internet pelanggan tetap keluar melalui WAN MikroTik dan tidak dilewatkan ke VPS.")

    add_heading(doc, "18.1 Topologi dan alamat tunnel", 2)
    add_table(doc, ["Komponen", "Alamat publik", "Alamat WireGuard", "Peran"], [
        ("VPS Ubuntu", "IP_PUBLIK_VPS", "10.99.0.1/30", "Endpoint WireGuard + FreeRADIUS"),
        ("MikroTik fisik/CHR1", "Boleh dinamis/CGNAT", "10.99.0.2/30", "Peer yang memulai tunnel + RADIUS client"),
    ])
    add_code(doc, '''PPPoE modem → MikroTik → WireGuard terenkripsi → VPS FreeRADIUS → MySQL
Internet pelanggan → MikroTik WAN langsung (tidak melalui WireGuard/VPS)''')
    add_note(doc, "AllowedIPs", "Gunakan hanya 10.99.0.1/32 dan 10.99.0.2/32. Jangan memakai 0.0.0.0/0 karena tunnel ini hanya untuk RADIUS/management, bukan default gateway pelanggan.", AMBER)

    add_heading(doc, "18.2 Persiapan firewall cloud/VPS", 2)
    add_bullets(doc, [
        "Pada firewall/security group provider VPS, buka UDP 51820 dari internet agar MikroTik dapat memulai handshake.",
        "Buka TCP 22 hanya dari IP administrator jika memungkinkan.",
        "Buka TCP 80/443 untuk web sesuai kebutuhan.",
        "Jangan membuka TCP 3306 (MySQL) ke internet.",
        "Jangan membuka UDP 1812/1813 ke internet; kedua port hanya diizinkan dari IP tunnel 10.99.0.2.",
    ])
    add_note(doc, "CGNAT", "MikroTik tetap dapat membangun tunnel meskipun berada di belakang NAT/CGNAT karena MikroTik yang menghubungi IP publik VPS dan memakai persistent keepalive.", GREEN)

    add_heading(doc, "18.3 Instalasi dan pembuatan key di VPS", 2)
    add_code(doc, '''sudo apt update
sudo apt install -y wireguard wireguard-tools tcpdump
sudo install -d -m 700 /etc/wireguard
umask 077
wg genkey | sudo tee /etc/wireguard/wg0.key >/dev/null
sudo cat /etc/wireguard/wg0.key | wg pubkey | sudo tee /etc/wireguard/wg0.pub
wg genpsk | sudo tee /etc/wireguard/chr1.psk >/dev/null
sudo chmod 600 /etc/wireguard/wg0.key /etc/wireguard/chr1.psk
sudo cat /etc/wireguard/wg0.pub
sudo cat /etc/wireguard/chr1.psk''')
    add_body(doc, "Catat VPS_PUBLIC_KEY dan PRESHARED_KEY. Private key VPS pada wg0.key tidak boleh dikirim, ditempel ke MikroTik, atau disimpan di repository.")

    add_heading(doc, "18.4 Membuat interface WireGuard di MikroTik", 2)
    add_code(doc, '''/interface wireguard add name=wg-vps listen-port=51821 comment="Tunnel aman ke VPS"
/ip address add address=10.99.0.2/30 interface=wg-vps comment="IP RADIUS tunnel"
/interface wireguard print detail where name=wg-vps''')
    add_body(doc, "Salin nilai public-key dari interface wg-vps sebagai CHR1_PUBLIC_KEY. Jangan menyalin private-key.")

    add_heading(doc, "18.5 Membuat konfigurasi wg0 di VPS", 2)
    add_code(doc, "sudo install -m 600 /dev/null /etc/wireguard/wg0.conf\nsudo nano /etc/wireguard/wg0.conf")
    add_code(doc, '''[Interface]
Address = 10.99.0.1/30
ListenPort = 51820
PrivateKey = ISI_FILE_WG0_KEY_VPS

[Peer]
PublicKey = CHR1_PUBLIC_KEY
PresharedKey = PRESHARED_KEY
AllowedIPs = 10.99.0.2/32''')
    add_body(doc, "Ambil private key VPS secara lokal dengan sudo cat /etc/wireguard/wg0.key, tempel hanya pada wg0.conf, lalu bersihkan terminal bila diperlukan.")
    add_code(doc, '''sudo chmod 600 /etc/wireguard/wg0.conf
sudo systemctl enable --now wg-quick@wg0
sudo systemctl status wg-quick@wg0 --no-pager
sudo wg show
ip -br address show wg0
ip route show dev wg0''')

    add_heading(doc, "18.6 Menambahkan peer VPS pada MikroTik", 2)
    add_code(doc, '''/interface wireguard peers add interface=wg-vps \
  public-key="VPS_PUBLIC_KEY" preshared-key="PRESHARED_KEY" \
  endpoint-address=IP_PUBLIK_VPS endpoint-port=51820 \
  allowed-address=10.99.0.1/32 persistent-keepalive=25s \
  comment="VPS FreeRADIUS"

/interface wireguard peers print detail
/ping 10.99.0.1 src-address=10.99.0.2 count=5''')
    add_note(doc, "Endpoint", "Jika memakai domain, endpoint-address boleh diisi radius.domain-anda.com. Pastikan DNS MikroTik sudah bekerja dan domain menunjuk ke IP publik VPS.")

    add_heading(doc, "18.7 Firewall UFW untuk WireGuard dan RADIUS", 2)
    add_code(doc, '''sudo ufw allow 51820/udp comment 'WireGuard MikroTik'
sudo ufw allow in on wg0 from 10.99.0.2 to 10.99.0.1 port 1812 proto udp comment 'RADIUS auth via WG'
sudo ufw allow in on wg0 from 10.99.0.2 to 10.99.0.1 port 1813 proto udp comment 'RADIUS acct via WG'
sudo ufw status numbered''')
    add_body(doc, "Jika sebelumnya pernah membuka 1812/1813 untuk semua alamat atau IP publik MikroTik, hapus rule tersebut berdasarkan nomor dari sudo ufw status numbered, lalu periksa ulang. Jangan menyalin nomor rule dari contoh karena nomor pada setiap VPS berbeda.")
    add_code(doc, '''sudo ss -lunp | grep -E ':51820|:1812|:1813'
sudo wg show''')

    add_heading(doc, "18.8 Ubah FreeRADIUS agar mengenali IP tunnel", 2)
    add_body(doc, "Edit clients.conf pada VPS. Nonaktifkan definisi client lama yang memakai IP publik/management CHR1, lalu gunakan alamat WireGuard MikroTik.")
    add_code(doc, "sudo nano /etc/freeradius/3.0/clients.conf")
    add_code(doc, '''client mikrotik-wireguard {
    ipaddr = 10.99.0.2
    secret = GANTI_RADIUS_SECRET_PANJANG
    shortname = mikrotik-wg
    nas_type = mikrotik
}''')
    add_code(doc, '''sudo freeradius -XC
sudo systemctl restart freeradius
sudo systemctl status freeradius --no-pager''')
    add_note(doc, "Dua lapisan keamanan", "WireGuard mengenkripsi jalur jaringan, sedangkan shared secret RADIUS tetap wajib dan harus sama pada MikroTik serta FreeRADIUS.", GREEN)

    add_heading(doc, "18.9 Arahkan RADIUS MikroTik ke IP WireGuard VPS", 2)
    add_code(doc, "/radius print detail")
    add_body(doc, "Catat nomor ID konfigurasi RADIUS PPP, misalnya 0. Ganti <ID_RADIUS> dengan nomor sebenarnya.")
    add_code(doc, '''/radius set <ID_RADIUS> address=10.99.0.1 src-address=10.99.0.2 \
  secret=GANTI_RADIUS_SECRET_PANJANG authentication-port=1812 \
  accounting-port=1813 timeout=3s
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
/radius print detail
/radius monitor <ID_RADIUS>''')
    add_note(doc, "Urutan aman", "Jangan menghapus konfigurasi RADIUS lama sebelum tunnel, ping, FreeRADIUS client, dan firewall berhasil diuji. Ubah alamat pada masa pemeliharaan agar pelanggan tidak terganggu.", AMBER)

    add_heading(doc, "18.10 Pengujian WireGuard + RADIUS", 2)
    add_steps(doc, [
        "Pada MikroTik, ping 10.99.0.1 menggunakan source 10.99.0.2.",
        "Pada VPS, jalankan sudo wg show dan pastikan latest handshake baru serta transfer bertambah.",
        "Pada VPS, jalankan sudo tcpdump -ni wg0 'udp port 1812 or udp port 1813'.",
        "Putuskan lalu sambungkan ulang PPPoE pada CHR2/modem uji.",
        "Pastikan paket Access-Request terlihat pada wg0, bukan interface publik VPS.",
        "Pastikan /radius monitor pada MikroTik menunjukkan requests dan accepts bertambah tanpa timeout/bad-replies.",
        "Pastikan CHR2 kembali connected dan sesi baru muncul pada radacct.",
    ])
    add_code(doc, '''sudo wg show
sudo tcpdump -ni wg0 'udp port 1812 or udp port 1813'
sudo journalctl -u freeradius -n 100 --no-pager''')

    add_heading(doc, "18.11 Verifikasi RADIUS tidak terbuka langsung ke internet", 2)
    add_bullets(doc, [
        "Security group VPS hanya membuka UDP 51820, bukan 1812/1813.",
        "UFW hanya mengizinkan RADIUS dari 10.99.0.2 melalui interface wg0.",
        "Konfigurasi /radius MikroTik menunjuk ke 10.99.0.1 dengan src-address 10.99.0.2.",
        "clients.conf FreeRADIUS mengenali 10.99.0.2, bukan IP publik MikroTik.",
        "MySQL tetap mendengarkan localhost dan TCP 3306 tidak dibuka.",
        "AllowedIPs WireGuard tidak memakai 0.0.0.0/0.",
    ])

    add_heading(doc, "18.12 Troubleshooting WireGuard", 2)
    add_table(doc, ["Gejala", "Penyebab umum", "Tindakan"], [
        ("Tidak ada latest handshake", "UDP 51820 diblokir atau endpoint salah", "Cek security group, UFW, IP/domain VPS, dan port peer"),
        ("Handshake ada tetapi ping gagal", "AllowedIPs atau IP wg salah", "VPS peer = 10.99.0.2/32; MikroTik peer = 10.99.0.1/32"),
        ("Handshake kadang hilang", "MikroTik di belakang NAT/CGNAT", "Pastikan persistent-keepalive=25s"),
        ("Ping tunnel berhasil, RADIUS timeout", "UFW atau clients.conf belum memakai IP tunnel", "Cek UDP 1812/1813 pada wg0 dan client 10.99.0.2"),
        ("bad-replies bertambah", "Shared secret berbeda", "Samakan secret tanpa spasi tambahan"),
        ("RADIUS lewat interface publik", "Address RADIUS masih IP publik VPS", "Ubah address menjadi 10.99.0.1 dan src-address 10.99.0.2"),
        ("Internet pelanggan ikut masuk tunnel", "AllowedIPs terlalu lebar", "Hapus 0.0.0.0/0; gunakan hanya 10.99.0.1/32"),
    ])
    add_code(doc, '''# VPS
sudo wg show
sudo journalctl -u wg-quick@wg0 -n 100 --no-pager
sudo ip route get 10.99.0.2
sudo ufw status numbered

# MikroTik
/interface wireguard print detail
/interface wireguard peers print detail
/ip route print where dst-address=10.99.0.1/32
/radius monitor <ID_RADIUS>
/log print where topics~"wireguard|radius|ppp"''')

    add_heading(doc, "18.13 Uji WireGuard lebih dulu di VirtualBox (opsional)", 2)
    add_body(doc, "Konfigurasi yang sama dapat diuji sebelum membeli VPS. Gunakan Ubuntu lab sebagai endpoint dengan endpoint-address=192.168.56.10 pada peer MikroTik. Alamat tunnel tetap 10.99.0.1/30 dan 10.99.0.2/30. Setelah pindah ke VPS, cukup ganti endpoint-address ke IP/domain publik VPS dan sesuaikan firewall cloud.")
    add_note(doc, "Hasil akhir produksi", "Hanya paket RADIUS dan management yang melewati WireGuard. PPPoE tetap berakhir di MikroTik dan trafik pelanggan tetap keluar melalui koneksi internet MikroTik.", GREEN)

    add_heading(doc, "19. Checklist keberhasilan", 1)
    checklist = [
        "□ Ubuntu memiliki internet dan IP management 192.168.56.10.",
        "□ CHR1 memiliki WAN internet dan IP management 192.168.56.11.",
        "□ CHR2 memiliki IP management 192.168.56.12.",
        "□ Browser Windows membuka Laravel melalui 192.168.56.10.",
        "□ Migration PPPoE/RADIUS berstatus Ran.",
        "□ freeradius -XC tidak menghasilkan error.",
        "□ radtest menghasilkan Access-Accept.",
        "□ CHR1 /radius monitor menunjukkan accepts dan tidak ada timeout/bad-replies.",
        "□ CHR2 pppoe-out1 berstatus connected.",
        "□ CHR2 mendapat IP 10.20.0.x.",
        "□ CHR2 dapat ping 8.8.8.8 dan google.com.",
        "□ Sesi tercatat pada radacct.",
        "□ Toggle paket OFF menolak login baru dan ON mengizinkannya kembali.",
        "□ WireGuard VPS–MikroTik memiliki latest handshake yang baru.",
        "□ MikroTik dapat ping 10.99.0.1 dari source 10.99.0.2.",
        "□ RADIUS MikroTik memakai address 10.99.0.1 dan src-address 10.99.0.2.",
        "□ UDP 1812/1813 tidak dibuka pada public firewall/security group VPS.",
        "□ Trafik pelanggan tetap keluar WAN MikroTik, bukan melalui WireGuard.",
        "□ Snapshot dan backup sudah dibuat.",
    ]
    for item in checklist:
        add_body(doc, item)

    add_heading(doc, "Referensi resmi", 1)
    sources = [
        ("MikroTik: CHR", "https://help.mikrotik.com/docs/spaces/ROS/pages/18350234/Cloud%2BHosted%2BRouter%2BCHR"),
        ("MikroTik: Instalasi CHR pada VirtualBox", "https://help.mikrotik.com/docs/spaces/ROS/pages/262864931/CHR%2Binstalling%2Bon%2BVirtualBox"),
        ("MikroTik: PPPoE", "https://help.mikrotik.com/docs/spaces/ROS/pages/2031625/PPPoE"),
        ("MikroTik: PPP AAA", "https://help.mikrotik.com/docs/spaces/ROS/pages/132350049/PPP%2BAAA"),
        ("MikroTik: RADIUS", "https://help.mikrotik.com/docs/spaces/ROS/pages/328097/RADIUS"),
        ("MikroTik: WireGuard", "https://help.mikrotik.com/docs/spaces/ROS/pages/69664792/WireGuard"),
        ("FreeRADIUS: SQL HOWTO Debian/Ubuntu", "https://wiki.freeradius.org/guide/SQL-HOWTO-for-freeradius-3.x-on-Debian-Ubuntu"),
        ("FreeRADIUS: Menambahkan client", "https://www.freeradius.org/documentation/freeradius-server/3.2.9/tutorials/new_client.html"),
        ("Ubuntu Server: Instalasi dasar", "https://ubuntu.com/server/docs/tutorial/basic-installation/"),
        ("Ubuntu Server: MySQL", "https://ubuntu.com/server/docs/install-and-configure-a-mysql-server"),
        ("Ubuntu Server: Nginx", "https://ubuntu.com/server/docs/how-to/web-services/configure-nginx/"),
        ("Ubuntu Server: WireGuard VPN", "https://ubuntu.com/server/docs/how-to/wireguard-vpn/"),
        ("Ubuntu Server: WireGuard security tips", "https://ubuntu.com/server/docs/how-to/wireguard-vpn/security-tips/"),
        ("Laravel: Deployment", "https://laravel.com/framework/docs/master/deployment"),
        ("Vite 8: Persyaratan Node.js", "https://v8.vite.dev/blog/announcing-vite8"),
        ("VirtualBox 7.2 User Manual", "https://download.virtualbox.org/virtualbox/7.2.0/UserManual.pdf"),
    ]
    for name, url in sources:
        paragraph = doc.add_paragraph(style="List Bullet")
        add_hyperlink(paragraph, name, url)

    add_note(doc, "Selesai", "Jika seluruh checklist lulus, lab sudah membuktikan alur Laravel → MySQL → FreeRADIUS → CHR1 → CHR2 → internet, dan koneksi produksi VPS–MikroTik telah diamankan dengan WireGuard.", GREEN)

    # Document properties
    doc.core_properties.title = "Panduan Setup Lab PPPoE VirtualBox"
    doc.core_properties.subject = "Ubuntu Laravel FreeRADIUS, WireGuard VPS, CHR1 PPPoE Server, CHR2 Modem"
    doc.core_properties.author = "OpenAI Codex untuk PT Unzanet"
    doc.core_properties.keywords = "VirtualBox, Ubuntu, VPS, WireGuard, Laravel, FreeRADIUS, MikroTik, CHR, PPPoE"

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    return OUTPUT


if __name__ == "__main__":
    print(build_document())
