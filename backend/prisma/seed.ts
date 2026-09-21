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
    where: { email: 'teknisi@unzanet.com' },
    update: {},
    create: { name: 'Teknisi Demo', email: 'teknisi@unzanet.com', password: await hash('password', 12), role: 'teknisi', status: 'active' },
  });
}

await main().finally(() => prisma.$disconnect());
