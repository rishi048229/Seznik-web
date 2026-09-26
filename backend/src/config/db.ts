import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const ec2EnvPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  '/home/ubuntu/inventort-seznik/backend/.env',
  '/home/ubuntu/inventort-seznik/.env',
  '/home/ubuntu/Seznik-web/backend/.env',
];
dotenv.config();
for (const envPath of ec2EnvPaths) {
  dotenv.config({ path: envPath });
}

const prisma = new PrismaClient();

/**
 * Opens several pooled connections up front.
 *
 * Prisma creates connections lazily, so the first request that fans out into N parallel queries
 * pays for N TLS handshakes at once. Against a cross-region database that is seconds, not
 * milliseconds: measured 3.3s for six parallel `SELECT 1` on a cold pool versus 0.3s once the
 * connections exist. Paying that cost at boot keeps it off the first user request.
 */
export async function warmConnectionPool(size = 8): Promise<void> {
  const started = Date.now();
  try {
    await Promise.all(
      Array.from({ length: size }, () => prisma.$queryRaw`SELECT 1`)
    );
    console.log(`[db] connection pool warmed (${size} connections) in ${Date.now() - started}ms`);
  } catch (error) {
    console.warn('[db] connection pool warmup failed:', error instanceof Error ? error.message : error);
  }
}

export default prisma;
