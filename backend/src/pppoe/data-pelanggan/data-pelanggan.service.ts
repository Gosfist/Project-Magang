import { assertOutputPort, lockOutputNodes, outputPortCount } from '../../main-core/shared/output-ports.js';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';
import { SaveAccountDto } from './data-pelanggan.dto.js';

import { RadiusService } from '../shared/radius.service.js';
import { SecretService } from '../shared/secret.service.js';
import { PppoeNetworkService } from '../shared/pppoe-network.service.js';
import { validateIdCardPhoto } from './id-card-photo.js';
import { readInstallationPhoto } from './installation-photo.js';
import { WhatsappNotifyService } from '../../bot-whatsapp/shared/whatsapp-notify.service.js';
import { customerSearch } from '../../common/customer-search.js';

@Injectable()
export class DataPelangganService {
  private readonly logger = new Logger(DataPelangganService.name);

  constructor(private readonly prisma: PrismaService, private readonly radius: RadiusService, private readonly secrets: SecretService, private readonly network: PppoeNetworkService, private readonly waNotify?: WhatsappNotifyService) { }

  private networkMessage(message: string, warnings: string[]) {
    return warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : `${message} Permintaan Disconnect RADIUS selesai.`;
  }

  async nasOptions() {
    const data = await this.prisma.nas.findMany({ where: { isActive: true }, select: { id: true, nasname: true, shortname: true, description: true }, orderBy: { nasname: 'asc' } });
    return serialize({ data });
  }

  async odpOptions() {
    const nodes = await this.prisma.mainCore.findMany({ where: { tipeTitik: { in: ['server', 'rasio', 'odc', 'odp'] }, deletedAt: null }, select: { id: true, parentId: true, routerNasId: true, namaTitik: true, alamat: true, tipeTitik: true, spesifikasi: true, parentPortOut: true }, orderBy: { namaTitik: 'asc' } });
    const accounts = await this.prisma.pppoeAccount.findMany({ where: { odpPort: { not: null } }, select: { id: true, odp: true, odpPort: true } });
    const byId = new Map(nodes.map(node => [node.id.toString(), node]));
    const routers = await this.prisma.nas.findMany({ where: { isActive: true }, select: { id: true, nasname: true, shortname: true } });
    const routerById = new Map(routers.map(router => [router.id, router.shortname || router.nasname]));
    const data = nodes.filter(node => node.tipeTitik === 'odc' || node.tipeTitik === 'odp').map(node => {
      let current: typeof node | undefined = node;
      const visited = new Set<string>();
      let routerNasId: number | null = null;
      while (current && !visited.has(current.id.toString())) {
        visited.add(current.id.toString());
        if (current.tipeTitik === 'server') {
          routerNasId = current.routerNasId && routerById.has(current.routerNasId) ? current.routerNasId : null;
          break;
        }
        current = current.parentId ? byId.get(current.parentId.toString()) : undefined;
      }
      const ports = Array.from({ length: outputPortCount(node.spesifikasi) }, (_, i) => {
        const number = i + 1;
        const account = accounts.find(item => item.odp === String(node.id) && item.odpPort === number);
        const childUsed = nodes.some(child => child.parentId === node.id && child.parentPortOut === number);
        return { number, used: childUsed || !!account, accountId: !childUsed && account ? account.id : null };
      });
      return { id: node.id, namaTitik: node.namaTitik, alamat: node.alamat, tipeTitik: node.tipeTitik, routerNasId, routerName: routerNasId ? routerById.get(routerNasId) : null, ports };
    });
    return serialize({ data });
  }

  async accounts(search = '', page = 1, status = '', session = '', numberOnly = false) {
    if (!['', 'active', 'isolated', 'terminated'].includes(status) || !['', 'online', 'offline'].includes(session)) throw new BadRequestException('Filter status atau sesi tidak valid.');
    const where: Prisma.PppoeAccountWhereInput = search ? { OR: [{ customerName: { contains: search } }, { username: { contains: search } }, { phone: { contains: search } }, ...(search.startsWith('62') ? [{ phone: { contains: `0${search.slice(2)}` } }] : []), ...(/^\d{1,18}$/.test(search) ? [{ customerNumber: BigInt(search) }] : [])] } : {};
    if (numberOnly && search) Object.assign(where, customerSearch(search));
    const active: Prisma.PppoeAccountWhereInput = { terminatedAt: null, manualIsolated: false, isActive: true, package: { isActive: true }, OR: [
      { paymentPromises: { some: { status: 'ACTIVE', deadline: { gt: new Date() } } } },
      { paymentPromises: { none: { status: 'ACTIVE' } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date(Date.now() - 86400000) } }] },
    ] };
    if (status) where.AND = [status === 'terminated' ? { termination: { isNot: null } } : status === 'active' ? { AND: [active, { termination: { is: null } }] } : { AND: [{ NOT: active }, { termination: { is: null } }] }];
    const [items, count] = await this.prisma.$transaction([
      this.prisma.pppoeAccount.findMany({ where, include: { termination: { select: { status: true } }, paymentPromises: { where: { status: 'ACTIVE' }, select: { deadline: true }, take: 1 }, psbOrder: { select: { installationPhoto: true, completedAt: true } }, package: { include: { ipPool: true } }, routerNas: { select: { id: true, nasname: true, shortname: true, description: true } }, area: { select: { id: true, name: true } } }, omit: { password: true }, orderBy: { customerNumber: 'asc' }, ...(session ? {} : { skip: (page - 1) * 5, take: 5 }) }),
      this.prisma.pppoeAccount.count({ where }),
    ]);
    const presence = await this.network.accountPresence(items);
    const filtered = session ? items.filter(item => presence.states.get(item.username) === (session === 'online')) : items;
    const total = session ? filtered.length : count;
    const visible = session ? filtered.slice((page - 1) * 5, page * 5) : filtered;
    return serialize({ data: visible.map((item) => ({ ...item, customerId: item.customerNumber.toString().padStart(6, '0'), online: presence.states.get(item.username) ?? null,
      uptime: presence.uptimes?.get(item.username) ?? null,
      serviceStatus: item.termination ? 'Berhenti Langganan' : !item.manualIsolated && item.isActive && item.package.isActive && (item.paymentPromises.length ? item.paymentPromises[0].deadline.getTime() > Date.now() : !item.expiresAt || item.expiresAt.getTime() + 86400000 > Date.now()) ? 'Aktif' : 'Isolir',
      discount: Number(item.discount), package: { ...item.package, price: Number(item.package.price), costPrice: Number(item.package.costPrice) } })), meta: pageMeta(page, 5, total), warnings: presence.warnings });
  }

  async credentials(id: string) {
    const account = await this.findAccount(id);
    return { username: account.username, password: this.secrets.decrypt(account.password) };
  }

  async installationPhoto(id: string) {
    const account = await this.prisma.pppoeAccount.findUnique({
      where: { id: BigInt(id) },
      select: { psbOrder: { select: { installationPhoto: true } } },
    });
    if (!account) throw new NotFoundException('Pelanggan tidak ditemukan.');
    return readInstallationPhoto(account.psbOrder?.installationPhoto);
  }

  async createAccount(dto: SaveAccountDto) {
    if (!dto.password) throw new BadRequestException('Kata sandi PPPoE wajib diisi.');
    await this.validateAccountForm(dto, true);
    await this.findPackage(dto.pppoePackageId);
    try {
      const account = await this.createAccountTransaction(async (tx) => {
        await this.validateAccountPort(tx, dto);
        const maximum = await tx.pppoeAccount.aggregate({ _max: { customerNumber: true } });
        const customerNumber = (maximum._max.customerNumber ?? 0n) + 1n;
        const item = await tx.pppoeAccount.create({ data: { ...this.accountData(dto, this.secrets.encrypt(dto.password!), true), customerNumber }, include: { package: { include: { ipPool: true } } } });
        await this.radius.sync(tx, item);
        return item;
      });

      // Fire-and-forget WA notification
      if (this.waNotify) {
        this.waNotify.notifyRegistration({
          customerName: account.customerName,
          customerNumber: account.customerNumber,
          phone: account.phone,
          address: account.address,
          package: { name: account.package.name },
        }).catch((err) => {
          this.logger.warn(`Notifikasi WA registrasi error: ${err?.message || err}`);
        });
      }

      const { password: _password, ...safe } = account;
      return serialize({ message: `Akun PPPoE pelanggan ${account.customerName} berhasil ditambahkan.`, account: { ...safe, discount: Number(safe.discount) } });
    } catch (error) { this.unique(error, 'Nama pengguna PPPoE sudah digunakan.'); }
  }

  async updateAccount(id: string, dto: SaveAccountDto) {
    const current = await this.findAccount(id);
    if (current.terminatedAt) throw new BadRequestException('Pelanggan sudah berhenti langganan dan tidak dapat diaktifkan atau diubah kembali.');
    if ((dto.idCardNumber?.trim() || null) !== (current.idCardNumber || null)) throw new BadRequestException('Nomor KTP pelanggan terdaftar tidak dapat diganti.');
    const passwordChanged = dto.password ? dto.password !== this.secrets.decrypt(current.password) : false;
    if (current.manualIsolated && dto.manualIsolated === false) {
      dto.isActive = true;
      dto.expiresAt = undefined;
    }
    await this.validateAccountForm(dto, false, current.id);
    if (dto.idCardPhoto && dto.idCardPhoto !== current.idCardPhoto) await validateIdCardPhoto(dto.idCardPhoto);
    await this.findPackage(dto.pppoePackageId);
    try {
      const account = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ terminated_at: Date | null }[]>`SELECT terminated_at FROM daftar_pelanggan WHERE id = ${current.id} FOR UPDATE`;
        if (locked[0]?.terminated_at) throw new BadRequestException('Pelanggan sudah berhenti langganan.');
        await this.validateAccountPort(tx, dto, current.id);
        if (dto.isActive === false) await tx.paymentPromise.updateMany({ where: { pppoeAccountId: current.id, status: { in: ['ACTIVE', 'EXPIRED'] } }, data: { status: 'CANCELLED', disconnectPending: false } });
        const item = await tx.pppoeAccount.update({
          where: { id: current.id },
          data: { ...this.accountData(dto, dto.password ? this.secrets.encrypt(dto.password) : current.password, false), odpPort: dto.odpPort !== undefined ? dto.odpPort : current.odp === dto.odp?.trim() ? current.odpPort : null },
          include: { package: { include: { ipPool: true } } },
        });
        await this.radius.sync(tx, item, current.username);
        return item;
      });
      const { password: _password, ...safe } = account;
      const warnings: string[] = [];
      // Reactivation must also reload RADIUS pool/profile/rate on the active session.
      if (!account.isActive || current.isActive !== account.isActive || current.manualIsolated !== account.manualIsolated || !account.package.isActive || current.username !== account.username || passwordChanged
        || current.pppoePackageId !== account.pppoePackageId || current.routerNasId !== account.routerNasId) {
        warnings.push(...(await this.network.disconnect(current.username, current.routerNasId)).warnings);
      }
      if (current.isActive && !account.isActive && this.waNotify) {
        const pendingInvoices = await this.prisma.invoice.findMany({
          where: { pppoeAccountId: account.id, status: { in: ['PENDING', 'OVERDUE'] } },
          select: { amount: true, dueDate: true },
          orderBy: { dueDate: 'asc' },
        });
        await this.waNotify.notifyIsolation({
          customerName: account.customerName,
          customerNumber: account.customerNumber,
          phone: account.phone,
          packageName: account.package.name,
          totalAmount: pendingInvoices.reduce((total, invoice) => total + Number(invoice.amount), 0),
          dueDate: this.formatDate(pendingInvoices[0]?.dueDate),
        });
      }
      const message = 'Akun PPPoE berhasil diperbarui dan disinkronkan ke RADIUS.';
      return serialize({ message: warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : message, warnings, account: { ...safe, discount: Number(safe.discount) } });
    } catch (error) { this.unique(error, 'Nama pengguna PPPoE sudah digunakan.'); }
  }

  private async createAccountTransaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try { return await this.prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        const retry = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034'
          || (error.code === 'P2002' && /customer_number|customerNumber/.test(String(error.meta?.target))));
        if (!retry) throw error;
        if (attempt === 4) throw new ConflictException('Nomor pelanggan sedang digunakan proses lain. Coba simpan kembali.');
      }
    }
    throw new ConflictException('Nomor pelanggan belum dapat dibuat.');
  }

  async disconnectAccount(id: string) {
    const account = await this.findAccount(id);
    const result = await this.network.disconnect(account.username, account.routerNasId);
    return { ...result, message: this.networkMessage('Pemeriksaan dan pemutusan sesi selesai.', result.warnings) };
  }

  private async validateAccountForm(dto: SaveAccountDto, creating: boolean, accountId?: bigint) {
    for (const field of ['phone', 'idCardNumber'] as const) {
      const value = dto[field]?.trim();
      if (!value) continue;
      const order = await this.prisma.psbOrder.findFirst({
        where: { [field]: value, ...(accountId ? { OR: [{ pppoeAccountId: null }, { pppoeAccountId: { not: accountId } }] } : {}) },
        select: { id: true },
      });
      if (order) throw new ConflictException(`${field === 'phone' ? 'Nomor telepon' : 'Nomor KTP'} sudah digunakan pada registrasi pelanggan lain.`);
    }
    if (creating) {
      const fields = [dto.customerName, dto.phone, dto.idCardNumber, dto.idCardPhoto, dto.address];
      if (fields.some(value => !value?.trim())) {
        throw new BadRequestException('Seluruh data pelanggan, termasuk foto KTP, wajib diisi.');
      }
      await validateIdCardPhoto(dto.idCardPhoto!);
    }
    if (!dto.odp || !/^[1-9]\d*$/.test(dto.odp)) throw new BadRequestException('ODC / ODP wajib dipilih.');
    const odp = await this.prisma.mainCore.findFirst({ where: { id: BigInt(dto.odp), tipeTitik: { in: ['odc', 'odp'] } }, select: { id: true } });
    if (!odp) throw new BadRequestException('ODC / ODP tidak ditemukan. Pilih yang tersedia.');
  }

  private async validateAccountPort(tx: Prisma.TransactionClient, dto: SaveAccountDto, accountId?: bigint) {
    await lockOutputNodes(tx, [BigInt(dto.odp)]);
    const node = await tx.mainCore.findFirst({ where: { id: BigInt(dto.odp), tipeTitik: { in: ['odc', 'odp'] }, deletedAt: null } });
    if (!node) throw new BadRequestException('ODC / ODP tidak ditemukan.');
    if (dto.odpPort != null) await assertOutputPort(tx, node, dto.odpPort, accountId);
  }

  private accountData(dto: SaveAccountDto, password: string, creating: boolean) {
    const now = new Date();
    return {
      pppoePackageId: BigInt(dto.pppoePackageId), customerName: dto.customerName.trim(), username: dto.username.trim(), password,
      phone: dto.phone?.trim() || null, address: dto.address?.trim() || null,
      idCardNumber: dto.idCardNumber?.trim() || null,
      idCardPhoto: dto.idCardPhoto?.trim() || null,
      // Direct registration follows Sales -> technician activation defaults.
      subscriptionType: creating ? 'POSTPAID' : dto.subscriptionType || 'POSTPAID',
      billingDay: creating ? 1 : dto.billingDay ?? 1,
      discount: creating ? 0n : BigInt(dto.discount || 0),
      odp: dto.odp?.trim() || null,
      ...(dto.odpPort !== undefined ? { odpPort: dto.odpPort } : {}),
      routerNasId: dto.routerNasId ? Number(dto.routerNasId) : null,
      areaId: dto.areaId ? BigInt(dto.areaId) : null,
      expiresAt: !creating && dto.expiresAt ? new Date(`${dto.expiresAt}T00:00:00.000Z`) : null,
      manualIsolated: creating ? false : dto.manualIsolated ?? false,
      isActive: creating ? true : dto.isActive ?? false, notes: dto.notes?.trim() || null,
      updatedAt: now, ...(creating ? { createdAt: now } : {}),
    };
  }

  private formatDate(date?: Date) {
    if (!date) return undefined;
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(date);
  }

  private async findPackage(id: string) {
    const item = await this.prisma.pppoePackage.findUnique({ where: { id: BigInt(id) } });
    if (!item) throw new NotFoundException('Harga paket tidak ditemukan.');
    return item;
  }
  private async findAccount(id: string) {
    const item = await this.prisma.pppoeAccount.findUnique({ where: { id: BigInt(id) } });
    if (!item) throw new NotFoundException('Akun PPPoE tidak ditemukan.');
    return item;
  }
  private unique(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      if (/odp.*port/i.test(target)) throw new ConflictException('Port sudah terpakai. Pilih port lain.');
      if (/id_card_number|idCardNumber/.test(target)) throw new ConflictException('Nomor KTP sudah digunakan pelanggan lain.');
      if (/phone/.test(target)) throw new ConflictException('Nomor telepon sudah digunakan pelanggan lain.');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }
}
