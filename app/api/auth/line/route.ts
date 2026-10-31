import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { createSession, upsertLineUser } from '@/lib/auth/session';
import { HttpError } from '@/lib/http-error';
import { verifyLineIdToken } from '@/lib/line/verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Exchange a LIFF ID token for our session. Only the token's `sub` counts. */
export const POST = route(async (req) => {
  const { idToken } = await readBody(req, z.object({ idToken: z.string().min(1) }));

  const identity = await verifyLineIdToken(idToken).catch(() => {
    throw new HttpError(401, 'ยืนยันตัวตนกับ LINE ไม่สำเร็จ');
  });
  const user = await upsertLineUser(identity);

  const response = NextResponse.json({ ok: true });
  await createSession(user.id, response);
  return response;
});
