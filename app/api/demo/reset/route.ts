import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { db } from '@/lib/db';
import { requireDemo } from '@/lib/demo/guard';
import { seedDemo } from '@/lib/demo/seed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  requireDemo(req);
  await seedDemo(db());
  return NextResponse.json({ ok: true });
});
