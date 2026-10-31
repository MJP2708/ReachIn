import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { deliverOutbound } from '@/lib/incident/outbox';
import { arriveAtIncident } from '@/lib/incident/service';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  const position = await readBody(req, schema);
  const result = await arriveAtIncident(id, user.id, position);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `คุณยังอยู่ห่างจากบ้าน ${result.distanceM.toLocaleString('th-TH')} ม. ต้องอยู่ในระยะ ${result.radiusM} ม. จึงจะยืนยันว่าถึงแล้วได้`,
        distanceM: result.distanceM,
      },
      { status: 422 },
    );
  }
  afterResponse(() => deliverOutbound(result.outboundIds));
  return NextResponse.json({ ok: true });
});
