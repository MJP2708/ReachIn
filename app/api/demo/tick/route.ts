import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireDemo } from '@/lib/demo/guard';
import { runTick } from '@/lib/incident/tick';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FAST_FORWARD_MIN = 60;
const schema = z.object({ fastForward: z.boolean().default(false) });

/** Nobody waits ten minutes on stage: fast-forward skips the clock, demo rows only. */
export const POST = route(async (req) => {
  requireDemo(req);
  const { fastForward } = await readBody(req, schema);
  const now = new Date(
    Date.now() + (fastForward ? FAST_FORWARD_MIN * 60_000 : 0),
  );
  const result = await runTick({ now, demoOnly: true });
  return NextResponse.json({ ok: true, ...result });
});
