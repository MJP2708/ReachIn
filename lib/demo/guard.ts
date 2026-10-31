import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/http-error';

export const DEMO_COOKIE = 'ri_demo';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * With LINE off nobody can sign in as themselves, so every person and elder on
 * the site is fictional and the demo needs no password.
 */
export const demoOpen = () => !env().LINE_ENABLED;

/**
 * Real sign-in works with just a LINE Login channel and a LIFF app. That
 * doesn't close the demo: it never needs the Messaging API.
 */
export const liffEnabled = () =>
  Boolean(env().NEXT_PUBLIC_LIFF_ID && env().LINE_LOGIN_CHANNEL_ID);

/** With LINE on, an empty DEMO_SECRET turns /demo and its API off altogether. */
export const demoEnabled = () => demoOpen() || env().DEMO_SECRET.length > 0;

export function demoCookieValue() {
  return digest(`cookie:${env().DEMO_SECRET}`).toString('hex');
}

function matches(value: string | undefined) {
  if (!value) return false;
  return timingSafeEqual(digest(value), digest(demoCookieValue()));
}

export function secretMatches(candidate: string) {
  return timingSafeEqual(digest(candidate), digest(env().DEMO_SECRET));
}

export function requireDemo(req: NextRequest) {
  if (demoOpen()) return;
  if (!demoEnabled() || !matches(req.cookies.get(DEMO_COOKIE)?.value)) {
    throw new HttpError(404, 'ไม่พบหน้านี้');
  }
}

export async function hasDemoAccess() {
  if (demoOpen()) return true;
  const jar = await cookies();
  return matches(jar.get(DEMO_COOKIE)?.value);
}
