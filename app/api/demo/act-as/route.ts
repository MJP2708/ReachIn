import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { createSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { requireDemo } from '@/lib/demo/guard';
import { HttpError } from '@/lib/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Acting as someone is an ordinary session, so every privacy rule applies
 * unchanged. Limited to seeded people: this can never impersonate a real user.
 */
export const POST = route(async (req) => {
  requireDemo(req);
  const { userId } = await readBody(req, z.object({ userId: z.string() }));
  const user = await db().user.findFirst({
    where: { id: userId, isDemo: true },
  });
  if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้ตัวอย่างนี้');
  const response = NextResponse.json({ ok: true, displayName: user.displayName });
  await createSession(user.id, response);
  return response;
});
