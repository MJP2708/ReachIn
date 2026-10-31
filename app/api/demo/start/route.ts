import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { createSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { requireDemo } from '@/lib/demo/guard';
import { SOMSRI, seedDemo } from '@/lib/demo/seed';
import { handleDeviceEvent } from '@/lib/device/events';
import { HttpError } from '@/lib/http-error';
import { deliverOutbound } from '@/lib/incident/outbox';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIRST_PERSON = 'demo-somchai';

/** One tap from the landing page: fresh data, a helper's phone, and a fall. */
export const POST = route(async (req) => {
  requireDemo(req);
  await seedDemo(db());

  const device = await db().device.findFirst({ where: { elderId: SOMSRI } });
  if (!device) throw new HttpError(500, 'ไม่พบกล่องสาธิต');
  const { incidentId, outboundIds } = await handleDeviceEvent(device, 'FALL');
  afterResponse(() => deliverOutbound(outboundIds));

  const response = NextResponse.json({ ok: true, incidentId });
  await createSession(FIRST_PERSON, response);
  return response;
});
