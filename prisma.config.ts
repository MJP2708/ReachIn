import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Migrations go through the direct connection: Neon's pooler cannot hold the
// advisory lock that `migrate` takes.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: env('DIRECT_URL') },
});
