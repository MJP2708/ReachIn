import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http-error';
import { deliverOutbound } from '@/lib/incident/outbox';
import { openIncident } from '@/lib/incident/service';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Without a box, a person in the circle is what starts an incident. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  const member = await db().circleMember.findFirst({
    where: { userId: user.id, elderId: id, active: true },
    select: { id: true },
  });
  if (!member) throw new HttpError(404, 'ไม่พบข้อมูลนี้');

  const { incidentId, created, outboundIds } = await openIncident({
    elderId: id,
    deviceId: null,
    type: 'FALL',
  });
  await db().incidentEvent.create({
    data: { incidentId, kind: 'REPORTED', actorUserId: user.id },
  });
  afterResponse(() => deliverOutbound(outboundIds));
  return NextResponse.json({ ok: true, incidentId, created });
});
