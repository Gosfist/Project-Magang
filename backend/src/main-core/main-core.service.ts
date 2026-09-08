import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MainCore, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { SaveMainCoreDto } from './main-core.dto.js';

const TYPES = ['server', 'rasio', 'odc', 'odp'] as const;
type NodeType = (typeof TYPES)[number];
const LABELS: Record<NodeType, string> = { server: 'Server', rasio: 'Rasio', odc: 'ODC', odp: 'ODP' };
const CABLE_LOSS = 0.35;
const CONNECTOR_LOSS = 0.5;
const SAFETY_MARGIN = 1;

type Spec = { jenis_splitter?: string; rasio_redaman_ports?: Record<string, string> };

@Injectable()
export class MainCoreService {
  constructor(private readonly prisma: PrismaService) { }

  ensureType(type: string): asserts type is NodeType {
    if (!TYPES.includes(type as NodeType)) throw new NotFoundException('Kategori Main Core tidak ditemukan.');
  }

  async list(type: string, search = '', page = 1, perPage = 5) {
    this.ensureType(type);
    const where: Prisma.MainCoreWhereInput = {
      tipeTitik: type,
      deletedAt: null,
      ...(search ? { namaTitik: { contains: search } } : {}),
    };
    const [nodes, total] = await this.prisma.$transaction([
      this.prisma.mainCore.findMany({
        where,
        include: { parent: true },
        orderBy: { namaTitik: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.mainCore.count({ where }),
    ]);
    return serialize({ data: nodes.map((node) => this.present(node)), meta: pageMeta(page, perPage, total) });
  }

  async allOptions() {
    const nodes = await this.prisma.mainCore.findMany({
      where: { deletedAt: null },
      select: { id: true, namaTitik: true, tipeTitik: true },
      orderBy: { namaTitik: 'asc' },
    });
    return serialize({ data: nodes });
  }

  async parents(type: string, search = '', currentNodeId?: string, currentParentId?: string, category = '') {
    this.ensureType(type);
    if (type === 'server') return { data: [] };
    if (category && !TYPES.includes(category as NodeType)) throw new BadRequestException('Jenis kategori sumber tidak valid.');
    const candidates = await this.prisma.mainCore.findMany({
      where: {
        deletedAt: null,
        ...(category ? { tipeTitik: category } : {}),
        ...(search ? { namaTitik: { contains: search } } : {}),
        ...(currentNodeId ? { id: { not: BigInt(currentNodeId) } } : {}),
      },
      include: { children: { where: { deletedAt: null }, select: { id: true, parentPortOut: true } } },
      orderBy: { namaTitik: 'asc' },
      take: 60,
    });
    const data = candidates
      .filter((parent) => parent.id.toString() === currentParentId || this.hasAvailableOutput(parent))
      .slice(0, 20)
      .map((parent) => {
        const spec = this.spec(parent);
        return {
          id: parent.id,
          name: parent.namaTitik,
          type: parent.tipeTitik,
          redamanIn: parent.redamanIn === null ? null : Number(parent.redamanIn),
          splitterRatio: spec.jenis_splitter ?? null,
          rasioRedamanPorts: spec.rasio_redaman_ports ?? {},
          outputCount: this.outputCount(parent),
          usedPorts: parent.children
            .filter((child) => child.id.toString() !== currentNodeId)
            .map((child) => child.parentPortOut)
            .filter(Boolean),
        };
      });
    return serialize({ data });
  }

  async create(type: string, dto: SaveMainCoreDto) {
    this.ensureType(type);
    const data = await this.validateAndBuild(type, dto);
    try {
      const node = await this.prisma.mainCore.create({ data, include: { parent: true } });
      return serialize({ message: `${LABELS[type]} berhasil ditambahkan.`, node: this.present(node) });
    } catch (error) { this.handleUnique(error, type); }
  }

  async update(type: string, id: string, dto: SaveMainCoreDto) {
    this.ensureType(type);
    const current = await this.find(id, type);
    const data = await this.validateAndBuild(type, dto, current);
    try {
      const node = await this.prisma.mainCore.update({ where: { id: current.id }, data, include: { parent: true } });
      return serialize({ message: `${LABELS[type]} berhasil diperbarui.`, node: this.present(node) });
    } catch (error) { this.handleUnique(error, type); }
  }

  async remove(type: string, id: string) {
    this.ensureType(type);
    const node = await this.find(id, type);
    const children = await this.prisma.mainCore.findMany({
      where: { parentId: node.id, deletedAt: null }, select: { namaTitik: true }, orderBy: { namaTitik: 'asc' },
    });
    if (children.length) {
      throw new BadRequestException(`${LABELS[type]} tidak dapat dihapus karena masih terhubung dengan ${children.map((item) => item.namaTitik).join(', ')}.`);
    }
    await this.prisma.mainCore.delete({ where: { id: node.id } });
    return { message: `${LABELS[type]} berhasil dihapus.`, node: { namaTitik: node.namaTitik } };
  }

  async trace(category: string, nodeId: string) {
    this.ensureType(category);
    const nodes = await this.prisma.mainCore.findMany({ where: { deletedAt: null }, orderBy: [{ parentPortOut: 'asc' }, { namaTitik: 'asc' }] });
    const selected = nodes.find((node) => node.id.toString() === nodeId && node.tipeTitik === category);
    if (!selected) throw new NotFoundException('Nama titik tidak ditemukan atau tidak sesuai kategori.');
    const byId = new Map(nodes.map((node) => [node.id.toString(), node]));
    const children = new Map<string, MainCore[]>();
    nodes.forEach((node) => {
      if (!node.parentId) return;
      const key = node.parentId.toString();
      children.set(key, [...(children.get(key) ?? []), node]);
    });
    const ancestors: MainCore[] = [];
    const visited = new Set<string>();
    let current: MainCore | undefined = selected;
    while (current && !visited.has(current.id.toString())) {
      visited.add(current.id.toString());
      ancestors.unshift(current);
      current = current.parentId ? byId.get(current.parentId.toString()) : undefined;
    }
    const descendants = this.pathsToLeaves(selected, children, new Set());
    const prefix = ancestors.slice(0, -1);
    const paths = descendants.map((path) => [...prefix, ...path].map((node) => this.present(node)));
    const uniqueCount = new Set(paths.flat().map((node) => String(node.id))).size;
    return serialize({ selectedNode: this.present(selected), paths, traceNodeCount: uniqueCount });
  }

  private pathsToLeaves(node: MainCore, children: Map<string, MainCore[]>, seen: Set<string>): MainCore[][] {
    const id = node.id.toString();
    if (seen.has(id)) return [];
    const nextSeen = new Set(seen).add(id);
    const next = (children.get(id) ?? []).filter((child) => !nextSeen.has(child.id.toString()));
    if (!next.length) return [[node]];
    return next.flatMap((child) => this.pathsToLeaves(child, children, nextSeen).map((path) => [node, ...path]));
  }

  private async validateAndBuild(type: NodeType, dto: SaveMainCoreDto, current?: MainCore) {
    let parent: (MainCore & { children: Pick<MainCore, 'id' | 'parentPortOut'>[] }) | null = null;
    let parentPortOut: number | null = null;
    if (type !== 'server') {
      if (!dto.parentId) throw new BadRequestException('Sumber jalur wajib dipilih.');
      if (current && dto.parentId === current.id.toString()) throw new BadRequestException('Data tidak dapat menjadi sumber untuk dirinya sendiri.');
      parent = await this.prisma.mainCore.findFirst({
        where: { id: BigInt(dto.parentId), deletedAt: null },
        include: { children: { where: { deletedAt: null }, select: { id: true, parentPortOut: true } } },
      });
      if (!parent) throw new BadRequestException('Sumber jalur tidak ditemukan.');
      const otherChildren = parent.children.filter((child) => child.id !== current?.id);
      if (parent.tipeTitik === 'server') {
        if (otherChildren.length) throw new BadRequestException('Sumber jalur server sudah tersambung ke data lain.');
      } else {
        const outputCount = this.outputCount(parent);
        parentPortOut = Number(dto.parentPortOut ?? 0);
        if (parentPortOut < 1) throw new BadRequestException('Port sumber wajib dipilih.');
        if (parentPortOut > outputCount) throw new BadRequestException(`Port sumber hanya tersedia dari port 1 sampai ${outputCount}.`);
        if (otherChildren.some((child) => child.parentPortOut === parentPortOut)) throw new BadRequestException(`Port ${parentPortOut} sudah digunakan.`);
      }
      if (!dto.alamat?.trim()) throw new BadRequestException('Alamat wajib diisi.');
    }

    let spesifikasi = dto.spesifikasi ?? null;
    if (type === 'rasio') {
      const raw = (dto.spesifikasi?.rasio_redaman_ports ?? {}) as Record<string, string>;
      spesifikasi = { jenis_splitter: '1:2', rasio_redaman_ports: this.validateRatioPorts(raw) };
    } else if (type === 'odc' || type === 'odp') {
      const splitter = String(dto.spesifikasi?.jenis_splitter ?? '');
      if (!['1:2', '1:4', '1:8'].includes(splitter)) throw new BadRequestException('Jenis splitter hanya boleh 1:2, 1:4, atau 1:8.');
      spesifikasi = { jenis_splitter: splitter };
    }

    let redamanIn = dto.redamanIn ?? null;
    if (type !== 'server' && redamanIn === null && dto.jarakKabel !== undefined && parent) {
      const source = Number(parent.redamanIn ?? 0);
      const splitterLoss = this.splitterLoss(parent, parentPortOut);
      const cableLoss = (dto.jarakKabel / 1000) * CABLE_LOSS;
      const connectorLoss = type === 'odp' && parent.tipeTitik === 'odc' ? 2 * CONNECTOR_LOSS : 0;
      redamanIn = Math.round((source - splitterLoss - cableLoss - connectorLoss - SAFETY_MARGIN) * 100) / 100;
    }
    const now = new Date();
    const jakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    return {
      parentId: type === 'server' ? null : BigInt(dto.parentId!),
      parentPortOut: type === 'server' ? null : parentPortOut,
      namaTitik: dto.namaTitik.trim(), tipeTitik: type,
      redamanIn, jarakKabel: type === 'server' ? null : dto.jarakKabel ?? null,
      alamat: type === 'server' ? null : dto.alamat?.trim(),
      spesifikasi: spesifikasi as Prisma.InputJsonValue | undefined,
      tanggal: new Date(`${jakarta}T00:00:00.000Z`),
      updatedAt: now,
      ...(current ? {} : { createdAt: now }),
    };
  }

  private validateRatioPorts(ports: Record<string, string>) {
    if (!ports['1'] && !ports['2']) return { '1': '10%', '2': '90%' };
    const first = this.parsePercentage(ports['1']);
    const second = this.parsePercentage(ports['2']);
    if (first === null || second === null) throw new BadRequestException('Persentase Port 1 dan Port 2 harus lebih dari 0 sampai 100.');
    if (Math.abs(first + second - 100) > 0.001) throw new BadRequestException('Total persentase Port 1 dan Port 2 harus 100%.');
    return { '1': `${first}%`, '2': `${second}%` };
  }

  private parsePercentage(value: unknown) {
    const normalized = String(value ?? '').trim().replace(',', '.').replace('%', '');
    if (!/^(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)$/.test(normalized)) return null;
    const number = Number(normalized);
    return number > 0 && number <= 100 ? number : null;
  }

  private splitterLoss(parent: MainCore, port: number | null) {
    if (parent.tipeTitik === 'server') return 0;
    const spec = this.spec(parent);
    if (parent.tipeTitik === 'rasio' && port) {
      const percentage = this.parsePercentage(spec.rasio_redaman_ports?.[String(port)]);
      if (percentage) return -10 * Math.log10(percentage / 100);
    }
    const count = this.outputCount(parent);
    return count ? 10 * Math.log10(count) : 0;
  }

  private hasAvailableOutput(parent: MainCore & { children: unknown[] }) {
    return parent.tipeTitik === 'server' ? parent.children.length === 0 : parent.children.length < this.outputCount(parent);
  }

  private outputCount(node: MainCore) {
    return Number(this.spec(node).jenis_splitter?.replace('1:', '') ?? 0);
  }

  private spec(node: MainCore): Spec { return (node.spesifikasi ?? {}) as Spec; }

  private present(node: MainCore & { parent?: MainCore | null }) {
    const spec = this.spec(node);
    const ports = spec.rasio_redaman_ports ?? {};
    return {
      ...node,
      redamanIn: node.redamanIn === null ? null : Number(node.redamanIn),
      jarakKabel: node.jarakKabel === null ? null : Number(node.jarakKabel),
      jenisSplitter: spec.jenis_splitter ?? null,
      jumlahOutput: this.outputCount(node) || null,
      rasioRedamanPorts: ports,
      rasioRedaman: Object.entries(ports).map(([port, value]) => `Port ${port}: ${value}`).join(' Dan ') || null,
    };
  }

  private async find(id: string, type: NodeType) {
    const node = await this.prisma.mainCore.findFirst({ where: { id: BigInt(id), tipeTitik: type, deletedAt: null } });
    if (!node) throw new NotFoundException(`${LABELS[type]} tidak ditemukan.`);
    return node;
  }

  private handleUnique(error: unknown, type: NodeType): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(`Nama ${LABELS[type]} sudah digunakan!`);
    throw error;
  }
}
