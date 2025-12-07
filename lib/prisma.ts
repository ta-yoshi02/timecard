import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

const databaseUrl = process.env.DATABASE_URL;
const accelerateUrl = process.env.PRISMA_ACCELERATE_URL;

const createPrismaClient = () => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  // Prefer Accelerate / Data Proxy when URL is provided
  if (accelerateUrl) {
    return new PrismaClient({
      accelerateUrl,
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
