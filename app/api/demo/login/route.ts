import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import {
  DEMO_COOKIE,
  demoCookieValue,
  demoEnabled,
  secretMatches,
} from '@/lib/demo/guard';
import { HttpError } from '@/lib/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The secret travels in a POST body and becomes a cookie, never a URL. */
export const POST = route(async (req) => {
  if (!demoEnabled()) throw new HttpError(404, 'ไม่พบหน้านี้');
  const { secret } = await readBody(req, z.object({ secret: z.string() }));
  if (!secretMatches(secret)) throw new HttpError(401, 'รหัสไม่ถูกต้อง');

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE, demoCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 3600,
  });
  return response;
});
