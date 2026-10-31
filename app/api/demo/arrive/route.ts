import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { db } from '@/lib/db';
import { requireDemo } from '@/lib/demo/guard';
import { pointNorthOf } from '@/lib/geo';
import { HttpError } from '@/lib/http-error';
import { deliverOutbound } from '@/lib/incident/outbox';
import { arriveAtIncident } from '@/lib/incident/service';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  incidentId: z.string(),
  distanceM: z.number().min(0).max(5000),
});

/** Runs the real distance check from a synthetic position. */
export const POST = route(async (req) => {
  requireDemo(req);
  const { incidentId, distanceM } = await readBody(req, schema);
  const incident = await db().incident.findFirst({
    where: { id: incidentId, elder: { isDemo: true } },
    select: { acceptedById: true, elder: { select: { lat: true, lng: true } } },
  });
  if (!incident?.acceptedById) throw new HttpError(409, 'ยังไม่มีคนรับงาน');

  const result = await arriveAtIncident(
    incidentId,
    incident.acceptedById,
    pointNorthOf(incident.elder, distanceM),
  );
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `ห่างจากบ้าน ${result.distanceM} ม. เกินระยะ ${result.radiusM} ม.`,
      },
      { status: 422 },
    );
  }
  afterResponse(() => deliverOutbound(result.outboundIds));
  return NextResponse.json({ ok: true });
});
