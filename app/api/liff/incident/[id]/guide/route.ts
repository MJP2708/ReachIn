import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { deliverOutbound } from '@/lib/incident/outbox';
import { saveGuide } from '@/lib/incident/service';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const list = z.array(z.string().max(120)).max(20);
const schema = z.object({
  step: z.number().int().min(1).max(5),
  safetyChecks: list,
  redFlags: list,
  moves: list,
  watchChecks: list,
  emsTriggered: z.boolean(),
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  const outboundIds = await saveGuide(id, user.id, await readBody(req, schema));
  afterResponse(() => deliverOutbound(outboundIds));
  return NextResponse.json({ ok: true });
});
