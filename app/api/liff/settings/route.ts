import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  phone: z.string().regex(/^[0-9+\-\s]{9,15}$/).nullable(),
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { phone } = await readBody(req, schema);
  await db().user.update({ where: { id: user.id }, data: { phone } });
  return NextResponse.json({ ok: true });
});
