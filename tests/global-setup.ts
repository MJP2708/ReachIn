import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';
import { Client } from 'pg';

/** Create the test database if needed and bring it to the latest migration. */
export default async function setup() {
  const env = config({ path: '.env.test', quiet: true }).parsed ?? {};
  const url = new URL(env.DATABASE_URL!);
  const name = url.pathname.slice(1);

  url.pathname = '/reachin';
  const admin = new Client({ connectionString: url.toString() });
  try {
    await admin.connect();
  } catch {
    throw new Error('Test database is not running. Start it with: pnpm db:up');
  }
  const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (found.rowCount === 0) await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}
