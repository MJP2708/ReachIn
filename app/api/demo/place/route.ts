import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { db } from '@/lib/db';
import { requireDemo } from '@/lib/demo/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  elderId: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Stage GPS cannot pass a 100 m check against a house across town. */
export const POST = route(async (req) => {
  requireDemo(req);
  const { elderId, lat, lng } = await readBody(req, schema);
  await db().elder.updateMany({
    where: { id: elderId, isDemo: true },
    data: { lat, lng },
  });
  return NextResponse.json({ ok: true });
});
