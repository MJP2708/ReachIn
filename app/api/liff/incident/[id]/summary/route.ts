import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { deliverOutbound } from '@/lib/incident/outbox';
import { submitSummary } from '@/lib/incident/service';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  result: z.enum(['OK', 'MINOR_INJURY', 'EMS_CALLED']),
  checklist: z.array(z.string().max(120)).max(10),
  note: z.string().trim().max(500),
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  const outboundIds = await submitSummary(id, user.id, await readBody(req, schema));
  afterResponse(() => deliverOutbound(outboundIds));
  return NextResponse.json({ ok: true });
});
