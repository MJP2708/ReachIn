import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';

/** The smoke test needs a migrated, seeded database. */
export default function setup() {
  const env = { ...process.env, ...config({ path: '.env.test', quiet: true }).parsed };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { env, stdio: 'pipe' });
  execFileSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], { env, stdio: 'pipe' });
}
