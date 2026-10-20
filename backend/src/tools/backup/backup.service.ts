import { BadRequestException, ConflictException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { isIPv4 } from 'node:net';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SecretService } from '../../pppoe/shared/secret.service.js';
import { RadiusService } from '../../pppoe/shared/radius.service.js';
import { isolatedService, readIsolation } from '../../pppoe/shared/isolation-config.js';
import { BackupRouterDto, type BackupImportDto } from './backup.dto.js';
import { HEADERS, parseWorkbook, table, type ParsedRow } from './backup-workbook.js';
import { localScript, radiusScript, type LocalSettings } from './routeros-backup.js';
import { activeNetworkKey, internetPoolName, internetProfile, readNasNetwork, type NasNetwork } from '../../router/shared/nas-network.js';

type Client = Prisma.TransactionClient;
type ImportData = Prisma.PppoeAccountUncheckedCreateInput;
const key = (id: number) => `pppoe_backup_router_${id}`;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item)).digest('hex');
const filenameDate = () => new Date().toISOString().slice(0, 10);
const defaultSettings = (): LocalSettings => ({ localAddress: '', baseProfile: 'default' });

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService, private readonly secrets: SecretService, private readonly radius: RadiusService, private readonly jwt: JwtService) {}

  async options() {
    const [routers, configs, unassigned] = await Promise.all([
      this.prisma.nas.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, nasname: true, isActive: true, _count: { select: { accounts: true } } } }),
      this.prisma.appSetting.findMany({ where: { OR: [{ key: { startsWith: 'pppoe_backup_router_' } }, { key: { startsWith: 'nas_network_active_' } }] } }),
      this.prisma.pppoeAccount.count({ where: { routerNasId: null } }),
    ]);
    return { routers: routers.map(router => {
      let settings = defaultSettings();
      try { const value = configs.find(config => config.key === key(router.id)); if (value) settings = JSON.parse(value.value); } catch { /* Allow fixing corrupt non-sensitive settings in the form. */ }
      const network = configs.find(config => config.key === activeNetworkKey(router.id));
      if (network) { const value = JSON.parse(network.value) as NasNetwork; settings = { localAddress: value.internet.gateway, baseProfile: internetProfile(router.id) }; }
      return { id: router.id, name: router.name || router.nasname, isActive: router.isActive, count: router._count.accounts, settings, networkManaged: !!network };
    }), unassigned };
  }
  private async router(id: number) {
    const router = await this.prisma.nas.findUnique({ where: { id } });
    if (!router) throw new NotFoundException('Router/NAS tidak ditemukan.');
    return router;
  }
  async saveSettings(routerId: number, dto: BackupRouterDto) {
    await this.router(routerId);
    if (await readNasNetwork(this.prisma, routerId)) throw new BadRequestException('Gateway dan profil mengikuti prefix Router/NAS. Ubah melalui Edit Router NAS.');
    const settings = { localAddress: dto.localAddress, baseProfile: dto.baseProfile.trim() };
    if (settings.baseProfile.startsWith('UNZANET-BACKUP-')) throw new BadRequestException('Gunakan profil dasar PPPoE asli, bukan profil backup.');
    const value = JSON.stringify(settings);
    await this.prisma.appSetting.upsert({ where: { key: key(routerId) }, create: { key: key(routerId), value }, update: { value } });
    return { message: 'Pengaturan backup disimpan. Router belum diubah.', settings };
  }
  async script(routerId: number, mode: 'local' | 'radius', reconnect: boolean) {
    await this.router(routerId);
    let script: string;
    if (mode === 'radius') script = radiusScript(routerId);
    else {
      const network = await readNasNetwork(this.prisma, routerId);
      const row = network ? null : await this.prisma.appSetting.findUnique({ where: { key: key(routerId) } });
      if (!row && !network) throw new BadRequestException('Simpan gateway dan profil dasar backup untuk router ini terlebih dahulu.');
      let settings: LocalSettings;
      try { settings = network ? { localAddress: network.internet.gateway, baseProfile: internetProfile(routerId) } : JSON.parse(row!.value); } catch { throw new BadRequestException('Simpan ulang pengaturan backup router.'); }
      if (!isIPv4(settings.localAddress) || !settings.baseProfile?.trim()) throw new BadRequestException('Simpan ulang gateway dan profil dasar backup router.');
      const accounts = await this.prisma.pppoeAccount.findMany({ where: { routerNasId: routerId }, include: { package: { include: { ipPool: true } }, paymentPromises: { where: { status: 'ACTIVE' }, orderBy: { id: 'desc' }, take: 1 } }, orderBy: { customerNumber: 'asc' } });
      const isolation = await readIsolation(this.prisma, routerId);
      const now = Date.now();
      script = localScript(routerId, accounts.map(account => ({ customerNumber: String(account.customerNumber), username: account.username, password: this.secrets.decrypt(account.password), pool: network ? internetPoolName : account.package.ipPool?.name || account.package.addressPool || '', rate: `${account.package.uploadMbps}M/${account.package.downloadMbps}M`, packageId: String(account.pppoePackageId), isolated: isolatedService(account, account.paymentPromises[0] || null, now) })), settings, isolation, reconnect);
    }
    return new StreamableFile(Buffer.from(script), { type: 'text/plain; charset=utf-8', disposition: `attachment; filename="pppoe-${mode}-router-${routerId}-${filenameDate()}.rsc"` });
  }

  async workbook(template: boolean, routerId?: number) {
    if (routerId) await this.router(routerId);
    const [packages, routers, areas, points, accounts] = await Promise.all([
      this.prisma.pppoePackage.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.nas.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, nasname: true } }),
      this.prisma.area.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      this.prisma.mainCore.findMany({ where: { tipeTitik: { in: ['odc', 'odp'] }, deletedAt: null }, orderBy: { namaTitik: 'asc' }, select: { id: true, namaTitik: true } }),
      template ? [] : this.prisma.pppoeAccount.findMany({ where: routerId ? { routerNasId: routerId } : {}, include: { package: true }, orderBy: { customerNumber: 'asc' } }),
    ]);
    const book = new ExcelJS.Workbook(); book.creator = 'PT UNZANET'; book.created = new Date();
    const rows = accounts.map(account => [String(account.customerNumber).padStart(6, '0'), account.customerName, account.username, this.secrets.decrypt(account.password), account.package.name, account.routerNasId ? String(account.routerNasId) : '', account.areaId ? String(account.areaId) : '', account.odp || '', account.phone || '', account.idCardNumber || '', account.address || '', account.subscriptionType, String(account.billingDay), String(account.discount), account.isActive ? 'YA' : 'TIDAK', account.expiresAt?.toISOString().slice(0, 10) || '', account.createdAt?.toISOString() || '', account.notes || '']);
    const sheet = table(book, 'Akun PPPoE', HEADERS, rows);
    // Blank template with a clearly separate example; it cannot accidentally import a sample account.
    if (template) sheet.addRow(HEADERS.map(() => ''));
    for (const [column, formulae] of [[12, ['"PREPAID,POSTPAID"']], [15, ['"YA,TIDAK"']]] as const) {
      for (let row = 2; row <= Math.max(2, rows.length + 1); row++) sheet.getCell(row, column).dataValidation = { type: 'list', allowBlank: true, formulae: [...formulae] };
    }
    table(book, 'Referensi Paket', ['paket', 'pool_internet', 'upload_mbps', 'download_mbps'], packages.map(pkg => [pkg.name, pkg.addressPool || '', String(pkg.uploadMbps), String(pkg.downloadMbps)]));
    table(book, 'Referensi Router', ['router_id', 'nama_router'], routers.map(router => [String(router.id), router.name || router.nasname]));
    table(book, 'Referensi Area', ['area_id', 'nama_area'], areas.map(area => [String(area.id), area.name]));
    table(book, 'Referensi ODP', ['odp_id', 'nama_titik'], points.map(point => [String(point.id), point.namaTitik]));
    table(book, 'Petunjuk', ['kolom', 'keterangan'], [
      ['Cakupan', 'Backup akun PPPoE, bukan backup database penuh. Foto, invoice, pembayaran, PSB, dan janji bayar tidak disertakan.'],
      ['Keamanan', 'File backup berisi password PPPoE asli. Simpan hanya di tempat yang dapat diakses administrator.'],
      ['Pengisian', 'Isi sheet Akun PPPoE mulai baris 2. Jangan ubah nama/urutan kolom. Maksimal 1000 baris per impor. Semua ID, nomor, dan password berformat teks.'],
      ['Wajib', 'no_pelanggan, nama_pelanggan, username, password, paket, aktif. Gunakan referensi yang tersedia di server tujuan.'],
      ['no_pelanggan', 'Nomor positif, unik. Nol depan didukung. Tidak mengubah nomor akun yang sudah ada.'],
      ['password', 'Password asli; spasi dan huruf besar/kecil dipertahankan. Maksimal 64 karakter. Jangan memakai formula.'],
      ['paket / router_id', 'Paket harus sudah ada; router_id jika diisi harus terdaftar. Router kosong berarti belum ditugaskan dan tidak masuk script router. Impor tidak membuat paket/router/pool.'],
      ['area_id / odp_id', 'Opsional untuk pemulihan data lama. Jika diisi harus valid. Gunakan referensi di workbook.'],
      ['jenis_langganan', 'PREPAID atau POSTPAID; kosong berarti POSTPAID.'],
      ['tanggal_tagihan / diskon', 'Tanggal 1-31, default 1. Diskon rupiah bulat >= 0, default 0.'],
      ['aktif', 'YA atau TIDAK, wajib. Ini status administratif; masa berlaku dan janji bayar tetap diperiksa sistem.'],
      ['berlaku_sampai', 'YYYY-MM-DD; kosong berarti tanpa batas tanggal.'],
      ['tanggal_registrasi', 'Tanggal ISO, misalnya 2026-10-01T00:00:00.000Z. Akun baru dengan kolom kosong memakai waktu impor.'],
      ['Mode impor', 'Tambah saja menolak username lama. Tambah/perbarui mencocokkan username; nomor pelanggan harus sama. Semua baris divalidasi sebelum disimpan dalam satu transaksi.'],
      ['Efek impor', 'Memperbarui akun dan RADIUS. Tidak membuat tagihan atau mengirim WhatsApp. Sesi aktif tidak diputus otomatis; perubahan sesi berlaku saat reconnect.'],
    ]);
    table(book, 'Contoh', HEADERS, [['000123', 'Pelanggan Contoh', 'pelanggan.contoh', 'GantiPassword123', packages[0]?.name || 'Nama paket tersedia', String(routers[0]?.id || 1), '', '', '', '', '', 'POSTPAID', '1', '0', 'YA', '', '', 'Contoh saja; salin dan sesuaikan ke Akun PPPoE.']]);
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    return new StreamableFile(buffer, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', disposition: `attachment; filename="${template ? 'template' : 'backup'}-akun-pppoe-${routerId || 'semua'}-${filenameDate()}.xlsx"` });
  }

  private async validateRows(rows: ParsedRow[], mode: BackupImportDto['mode'], tx: Client = this.prisma) {
    const [packages, routers, areas, points, existing, orders] = await Promise.all([
      tx.pppoePackage.findMany({ include: { ipPool: true } }), tx.nas.findMany({ select: { id: true, name: true, nasname: true } }),
      tx.area.findMany({ select: { id: true } }), tx.mainCore.findMany({ where: { tipeTitik: { in: ['odc', 'odp'] }, deletedAt: null }, select: { id: true } }),
      tx.pppoeAccount.findMany({ select: { id: true, username: true, customerNumber: true, phone: true, idCardNumber: true, updatedAt: true, password: true } }),
      tx.psbOrder.findMany({ select: { phone: true, idCardNumber: true, customerNumber: true, pppoeAccountId: true } }),
    ]);
    const errors: { row: number; message: string }[] = [];
    const valid: { row: number; data: ImportData; existingId?: bigint; packageName: string; routerName: string }[] = [];
    const seen = new Map<string, number>();
    const uint = (value: string, label: string, max = 18446744073709551615n) => {
      if (!/^\d+$/.test(value) || BigInt(value) < 1n || BigInt(value) > max) throw new Error(`${label} harus bilangan positif yang valid.`);
      return BigInt(value);
    };
    const unique = (kind: string, value: string, row: number) => {
      if (!value) return;
      const token = `${kind}:${value.toLowerCase()}`;
      if (seen.has(token)) throw new Error(`${kind} duplikat dengan baris ${seen.get(token)}.`);
      seen.set(token, row);
    };
    for (const item of rows) {
      try {
        const d = item.data, username = d.username.trim();
        if (!/^[A-Za-z0-9._@-]{1,64}$/.test(username)) throw new Error('Username hanya huruf, angka, titik, _, @, dan -. Maksimal 64 karakter.');
        const customerNumber = uint(d.no_pelanggan.trim(), 'Nomor pelanggan');
        for (const [kind, value] of [['Username', username], ['Nomor pelanggan', String(customerNumber)], ['No WA', d.no_wa.trim()], ['No KTP', d.no_ktp.trim()]]) unique(kind, value, item.row);
        const current = existing.find(account => account.username.toLowerCase() === username.toLowerCase());
        if (current && (mode === 'create' || current.username !== username)) throw new Error('Username sudah ada. Gunakan mode Tambah/perbarui dan ejaan username yang sama.');
        if (current && current.customerNumber !== customerNumber) throw new Error('Nomor pelanggan tidak sama dengan akun username tersebut.');
        if (existing.some(account => account.customerNumber === customerNumber && account.id !== current?.id)) throw new Error('Nomor pelanggan sudah digunakan akun lain.');
        const pkg = packages.find(pkg => pkg.name === d.paket.trim());
        if (!pkg) throw new Error('Nama paket tidak ditemukan. Lihat Referensi Paket.');
        const routerId = d.router_id.trim() ? Number(uint(d.router_id.trim(), 'Router ID', 4294967295n)) : null;
        const router = routers.find(router => router.id === routerId);
        if (routerId !== null && !router) throw new Error('Router ID tidak ditemukan.');
        const areaId = d.area_id.trim() ? uint(d.area_id.trim(), 'Area ID') : null;
        if (areaId && !areas.some(area => area.id === areaId)) throw new Error('Area ID tidak ditemukan.');
        const odp = d.odp_id.trim() ? String(uint(d.odp_id.trim(), 'ODP ID')) : null;
        if (odp && !points.some(point => String(point.id) === odp)) throw new Error('ODC/ODP ID tidak ditemukan.');
        const phone = d.no_wa.trim() || null, idCardNumber = d.no_ktp.trim() || null;
        for (const [field, value, label] of [['phone', phone, 'No WA'], ['idCardNumber', idCardNumber, 'No KTP']] as const) {
          if (value && (existing.some(account => account[field]?.toLowerCase() === value.toLowerCase() && account.id !== current?.id) || orders.some(order => order[field]?.toLowerCase() === value.toLowerCase() && (!current || order.pppoeAccountId !== current.id)))) throw new Error(`${label} sudah digunakan pelanggan/registrasi lain.`);
        }
        if (orders.some(order => order.customerNumber === customerNumber && (!current || order.pppoeAccountId !== current.id))) throw new Error('Nomor pelanggan sudah digunakan registrasi PSB lain.');
        if (!d.nama_pelanggan.trim() || d.nama_pelanggan.length > 150 || !d.password || d.password.length > 64 || /[\x00-\x1F\x7F]/.test(d.password)) throw new Error('Nama wajib (maksimal 150) dan password wajib (maksimal 64, tanpa karakter kontrol).');
        if ((phone?.length || 0) > 30 || (idCardNumber?.length || 0) > 50 || d.alamat.length > 5000 || d.catatan.length > 5000) throw new Error('No WA/KTP/alamat/catatan terlalu panjang.');
        const subscriptionType = d.jenis_langganan.trim() || 'POSTPAID';
        if (!['PREPAID', 'POSTPAID'].includes(subscriptionType)) throw new Error('Jenis langganan harus PREPAID/POSTPAID.');
        const billingDay = Number(d.tanggal_tagihan.trim() || '1');
        if (!/^\d+$/.test(d.tanggal_tagihan.trim() || '1') || billingDay < 1 || billingDay > 31) throw new Error('Tanggal tagihan harus 1 sampai 31.');
        const discount = d.diskon.trim() || '0';
        if (!/^\d+$/.test(discount) || BigInt(discount) > 18446744073709551615n) throw new Error('Diskon harus rupiah bulat positif atau nol.');
        if (!['YA', 'TIDAK'].includes(d.aktif.trim())) throw new Error('Aktif harus YA atau TIDAK.');
        let expiresAt: Date | null = null;
        if (d.berlaku_sampai) {
          const value = d.berlaku_sampai.slice(0, 10);
          expiresAt = new Date(value + 'T00:00:00.000Z');
          if (!/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(d.berlaku_sampai) || !Number.isFinite(expiresAt.getTime()) || expiresAt.toISOString().slice(0, 10) !== value) throw new Error('Berlaku sampai harus tanggal YYYY-MM-DD yang valid.');
        }
        const createdAt = d.tanggal_registrasi ? new Date(d.tanggal_registrasi) : undefined;
        if (createdAt && (!/^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(d.tanggal_registrasi) || !Number.isFinite(createdAt.getTime()))) throw new Error('Tanggal registrasi harus tanggal ISO yang valid.');
        valid.push({ row: item.row, existingId: current?.id, packageName: pkg.name, routerName: router?.name || router?.nasname || 'Belum ditugaskan', data: { customerNumber, customerName: d.nama_pelanggan.trim(), username, password: d.password, pppoePackageId: pkg.id, routerNasId: routerId, areaId, odp, phone, idCardNumber, address: d.alamat || null, notes: d.catatan || null, subscriptionType, billingDay, discount: BigInt(discount), isActive: d.aktif.trim() === 'YA', expiresAt, ...(createdAt ? { createdAt } : {}) } });
      } catch (error) { if (errors.length < 100) errors.push({ row: item.row, message: error instanceof Error ? error.message : 'Data tidak valid.' }); }
    }
    // Includes unique-contact owners and reference changes to protect the reviewed preview.
    const fingerprint = digest({ existing: existing.sort((a, b) => a.id < b.id ? -1 : 1), packages: packages.sort((a, b) => a.id < b.id ? -1 : 1), routers: routers.sort((a, b) => a.id - b.id), areas: areas.sort((a, b) => a.id < b.id ? -1 : 1), points: points.sort((a, b) => a.id < b.id ? -1 : 1), orders: orders.sort((a, b) => a.customerNumber < b.customerNumber ? -1 : 1) });
    return { valid, errors, fingerprint };
  }

  async preview(buffer: Buffer | undefined, mode: BackupImportDto['mode'], userId: string) {
    const rows = await parseWorkbook(buffer);
    const result = await this.validateRows(rows, mode);
    const token = result.errors.length ? null : await this.jwt.signAsync({ purpose: 'pppoe-backup-import', actor: userId, file: digest(buffer), mode, fingerprint: result.fingerprint }, { expiresIn: '10m' });
    return { total: rows.length, create: result.valid.filter(row => !row.existingId).length, update: result.valid.filter(row => row.existingId).length, errors: result.errors,
      rows: result.valid.slice(0, 100).map(row => ({ row: row.row, customerNumber: String(row.data.customerNumber).padStart(6, '0'), customerName: row.data.customerName, username: row.data.username, packageName: row.packageName, routerName: row.routerName, action: row.existingId ? 'Perbarui' : 'Tambah' })), token };
  }
  async import(buffer: Buffer | undefined, dto: BackupImportDto, userId: string) {
    let ticket: { purpose: string; actor: string; file: string; mode: string; fingerprint: string };
    try { ticket = await this.jwt.verifyAsync(dto.token || ''); } catch { throw new BadRequestException('Pratinjau tidak valid/kedaluwarsa. Periksa file kembali.'); }
    if (ticket.purpose !== 'pppoe-backup-import' || ticket.actor !== userId || ticket.file !== digest(buffer) || ticket.mode !== dto.mode) throw new BadRequestException('File atau mode berbeda dari pratinjau. Periksa file kembali.');
    const rows = await parseWorkbook(buffer);
    try {
      const counts = await this.prisma.$transaction(async tx => {
        const result = await this.validateRows(rows, dto.mode, tx);
        if (result.errors.length || result.fingerprint !== ticket.fingerprint) throw new ConflictException('Data server berubah atau file tidak valid. Jalankan Periksa File kembali.');
        let created = 0, updated = 0;
        for (const row of result.valid) {
          const now = new Date(), data = { ...row.data, password: this.secrets.encrypt(row.data.password), updatedAt: now };
          const account = row.existingId
            ? await tx.pppoeAccount.update({ where: { id: row.existingId }, data, include: { package: { include: { ipPool: true } } } })
            : await tx.pppoeAccount.create({ data: { ...data, createdAt: data.createdAt || now }, include: { package: { include: { ipPool: true } } } });
          if (!account.isActive) await tx.paymentPromise.updateMany({ where: { pppoeAccountId: account.id, status: { in: ['ACTIVE', 'EXPIRED'] } }, data: { status: 'CANCELLED', disconnectPending: false } });
          await this.radius.sync(tx, account);
          if (row.existingId) updated++; else created++;
        }
        return { created, updated };
      }, { timeout: 120000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { ...counts, message: `Impor selesai: ${counts.created} akun ditambahkan, ${counts.updated} akun diperbarui dan RADIUS disinkronkan. Sesi aktif tidak diputus.` };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034', 'P2003'].includes(error.code)) throw new ConflictException('Terjadi konflik data saat impor. Semua perubahan dibatalkan; periksa file kembali.');
      throw error;
    }
  }
}
