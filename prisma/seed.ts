import 'dotenv/config';
import { db } from '../lib/db';
import { seedDemo } from '../lib/demo/seed';

await seedDemo(db());
await db().$disconnect();
console.log('Seeded demo data.');
