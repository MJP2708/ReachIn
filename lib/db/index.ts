import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
/** Anything that can run queries: the client or an open transaction. */
export type DbLike = Db | Tx;

/**
 * Accepts a URL pasted with its quotes, as in Neon's `psql '...'` snippet.
 * A quote can't appear in a valid URL: passwords percent-encode them.
 */
export function cleanDatabaseUrl(raw: string): string {
  return /postgres(?:ql)?:\/\/[^\s'"`]+/.exec(raw)?.[0] ?? raw;
}

const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

/**
 * One tested path everywhere: node-postgres against local Postgres and against
 * Neon's pooled URL alike, so what runs in the demo is what the tests ran.
 */
export function db(): PrismaClient {
  if (!globalForDb.prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
    globalForDb.prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: cleanDatabaseUrl(url),
        max: 8,
      }),
    });
  }
  return globalForDb.prisma;
}
