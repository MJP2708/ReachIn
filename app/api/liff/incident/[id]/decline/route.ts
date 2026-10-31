import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { deliverOutbound } from '@/lib/incident/outbox';
import { declineIncident } from '@/lib/incident/service';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  const result = await declineIncident(id, user.id);
  if (result.ok) afterResponse(() => deliverOutbound(result.outboundIds));
  return NextResponse.json({ ok: true });
});
