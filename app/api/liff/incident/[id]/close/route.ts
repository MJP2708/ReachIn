import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { deliverOutbound } from '@/lib/incident/outbox';
import { familyClose } from '@/lib/incident/service';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  const outboundIds = await familyClose(id, user.id);
  afterResponse(() => deliverOutbound(outboundIds));
  return NextResponse.json({ ok: true });
});
