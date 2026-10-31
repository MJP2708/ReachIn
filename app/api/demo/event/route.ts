import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { db } from '@/lib/db';
import { requireDemo } from '@/lib/demo/guard';
import { DEVICE_EVENT_TYPES, handleDeviceEvent } from '@/lib/device/events';
import { HttpError } from '@/lib/http-error';
import { deliverOutbound } from '@/lib/incident/outbox';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  elderId: z.string(),
  type: z.enum(DEVICE_EVENT_TYPES),
});

/** Goes through the same handler as a real box, minus the signature. */
export const POST = route(async (req) => {
  requireDemo(req);
  const { elderId, type } = await readBody(req, schema);
  const device = await db().device.findFirst({
    where: { elderId, elder: { isDemo: true } },
  });
  if (!device) throw new HttpError(404, 'ไม่พบกล่องของผู้สูงอายุคนนี้');
  const result = await handleDeviceEvent(device, type);
  afterResponse(() => deliverOutbound(result.outboundIds));
  return NextResponse.json({ ok: true, incidentId: result.incidentId ?? null });
});
