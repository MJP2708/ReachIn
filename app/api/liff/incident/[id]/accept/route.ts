import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { deliverOutbound } from '@/lib/incident/outbox';
import { acceptIncident } from '@/lib/incident/service';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  const result = await acceptIncident(id, user.id);
  if (result.outcome === 'won') {
    afterResponse(() => deliverOutbound(result.outboundIds));
    return NextResponse.json({ ok: true, outcome: 'won' });
  }
  return NextResponse.json(
    {
      outcome: 'lost',
      error: result.accepterName
        ? `${result.accepterName} รับงานแล้ว สแตนด์บายไว้ก่อน`
        : 'งานนี้ปิดไปแล้ว',
    },
    { status: 409 },
  );
});
