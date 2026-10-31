import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { requireDemo } from '@/lib/demo/guard';
import { handlePostback } from '@/lib/line/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  data: z.string().regex(/^action=(accept|decline|key)&incident=[\w-]+$/),
});

/** A tap in the simulated chat takes the same path as a real LINE postback. */
export const POST = route(async (req) => {
  requireDemo(req);
  const user = await requireUser(req);
  const { data } = await readBody(req, schema);
  await handlePostback(user.lineUserId, data, 'demo-reply');
  return NextResponse.json({ ok: true });
});
