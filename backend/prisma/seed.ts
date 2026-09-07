import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@unzanet.com' },
    update: {},
    create: { name: 'Administrator', email: 'admin@unzanet.com', password: await hash('123', 12), role: 'admin', status: 'active' },
  });
  await prisma.user.upsert({
    where: { email: 'petugas@unzanet.com' },
    update: {},
    create: { name: 'Petugas Demo', email: 'petugas@unzanet.com', password: await hash('password', 12), role: 'petugas', status: 'active' },
  });
}

await main().finally(() => prisma.$disconnect());
