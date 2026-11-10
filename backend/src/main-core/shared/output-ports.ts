import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function outputPortCount(spec: unknown): number {
  const splitter = (spec as { jenis_splitter?: string } | null)?.jenis_splitter;
  const match = typeof splitter === 'string' ? /^1:(2|4|8)$/.exec(splitter) : null;
  return match ? Number(match[1]) : 0;
}

// Share the node lock with topology writes, so customers and child nodes cannot claim the same output.
export async function lockOutputNodes(tx: Prisma.TransactionClient, ids: bigint[]) {
  for (const id of [...new Set(ids)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0)) {
    await tx.$queryRaw`SELECT id FROM main_core WHERE id = ${id} FOR UPDATE`;
  }
}

export async function assertOutputPort(tx: Prisma.TransactionClient, node: { id: bigint; spesifikasi: unknown }, port: number, excludeAccountId?: bigint, excludeChildId?: bigint) {
  const count = outputPortCount(node.spesifikasi);
  if (!Number.isInteger(port) || port < 1 || port > count) throw new BadRequestException(`Pilih port yang tersedia (1 sampai ${count}).`);
  const child = await tx.mainCore.findFirst({ where: { parentId: node.id, parentPortOut: port, deletedAt: null, ...(excludeChildId ? { id: { not: excludeChildId } } : {}) }, select: { id: true } });
  const account = await tx.pppoeAccount.findFirst({ where: { odp: String(node.id), odpPort: port, ...(excludeAccountId ? { id: { not: excludeAccountId } } : {}) }, select: { id: true } });
  if (child || account) throw new ConflictException(`Port ${port} sudah terpakai. Pilih port lain.`);
}
