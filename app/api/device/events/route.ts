import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  claimDeviceEvent,
  deviceEventSchema,
  handleDeviceEvent,
  isFreshTimestamp,
} from '@/lib/device/events';
import { decryptDeviceSecret, verifyDeviceSignature } from '@/lib/device/secret';
import { deliverOutbound } from '@/lib/incident/outbox';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reject = (status: number, error: string) =>
  NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return reject(400, 'invalid json');
  }
  const parsed = deviceEventSchema.safeParse(json);
  if (!parsed.success) return reject(400, 'invalid body');
  const { serial, type, ts } = parsed.data;

  // The signature is keyed per device, so the serial has to be read first.
  // Nothing else in the body is trusted until it verifies.
  const device = await db().device.findUnique({ where: { serial } });
  const signature = req.headers.get('x-device-signature');
  if (
    !device ||
    !verifyDeviceSignature(raw, signature, decryptDeviceSecret(device.secretEnc))
  ) {
    return reject(401, 'invalid signature');
  }
  if (!isFreshTimestamp(ts)) return reject(401, 'stale timestamp');

  if (!(await claimDeviceEvent(device.id, ts, type))) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const result = await handleDeviceEvent(device, type);
  // The state is already committed; sending happens after the response so the
  // box gets its answer inside a second.
  afterResponse(() => deliverOutbound(result.outboundIds));
  return NextResponse.json({
    ok: true,
    incidentId: result.incidentId ?? null,
    created: result.created ?? false,
  });
}
