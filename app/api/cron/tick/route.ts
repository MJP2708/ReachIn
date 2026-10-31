import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { runTick } from '@/lib/incident/tick';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Header only: a secret in the query string ends up in access logs. Vercel Cron
 * sends this Bearer header, and so can any other scheduler.
 */
function authorised(req: Request): boolean {
  const secret = Buffer.from(env().CRON_SECRET);
  const header = req.headers.get('authorization') ?? '';
  const provided = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
  return provided.length === secret.length && timingSafeEqual(provided, secret);
}

async function run(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const result = await runTick();
  console.log('[cron]', JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
