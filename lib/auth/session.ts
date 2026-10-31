import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http-error';
import { verifyLineIdToken, type VerifiedLineIdentity } from '@/lib/line/verify';

export const SESSION_COOKIE = 'ri_session';
const SESSION_DAYS = 30;

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** Our own opaque id: a LINE token in the browser would be a credential for LINE. */
export async function createSession(userId: string, response: NextResponse) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db().session.create({
    data: { id: hashToken(token), userId, expiresAt },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

async function userFromToken(token: string | undefined) {
  if (!token) return null;
  const session = await db().session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session.user;
}

export async function upsertLineUser(identity: VerifiedLineIdentity) {
  const profile = {
    displayName: identity.displayName,
    pictureUrl: identity.pictureUrl,
  };
  return db().user.upsert({
    where: { lineUserId: identity.lineUserId },
    create: { lineUserId: identity.lineUserId, ...profile },
    update: identity.displayName ? profile : {},
  });
}

/** For server components, which can see cookies but no request headers. */
export async function currentUser() {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Identify an API caller from the session cookie or a Bearer LIFF ID token,
 * and nothing else. A userId in the body or query is never read, so sending
 * someone else's has no effect.
 */
export async function requireUser(req: NextRequest) {
  const fromCookie = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (fromCookie) return fromCookie;

  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Bearer ')) {
    try {
      return await upsertLineUser(await verifyLineIdToken(header.slice(7)));
    } catch {
      throw new HttpError(401, 'ยืนยันตัวตนกับ LINE ไม่สำเร็จ');
    }
  }
  throw new HttpError(401, 'ต้องเข้าสู่ระบบก่อน');
}
