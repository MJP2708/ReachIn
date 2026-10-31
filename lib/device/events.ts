import { z } from 'zod';
import { db } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db/errors';
import { OPEN_STATES } from '@/lib/incident/machine';
import { applyEvent, openIncident } from '@/lib/incident/service';

export const DEVICE_EVENT_TYPES = [
  'FALL',
  'LONG_STAY',
  'VOICE_OK',
  'VOICE_HELP',
  'NO_RESPONSE',
  'STANDING',
  'HEARTBEAT',
] as const;

export type DeviceEventType = (typeof DEVICE_EVENT_TYPES)[number];

export const deviceEventSchema = z.object({
  serial: z.string().min(1).max(64),
  type: z.enum(DEVICE_EVENT_TYPES),
  /** Unix seconds. The ESP32 needs NTP; see docs/device-api.md. */
  ts: z.number().int().positive(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const MAX_DEVICE_CLOCK_SKEW_S = 300;

export function isFreshTimestamp(ts: number, now = new Date()): boolean {
  return Math.abs(now.getTime() / 1000 - ts) <= MAX_DEVICE_CLOCK_SKEW_S;
}

export type DeviceResult = {
  incidentId?: string;
  created?: boolean;
  duplicate?: boolean;
  outboundIds: string[];
};

/** Each signed message counts once, even if replayed inside the time window. */
export async function claimDeviceEvent(
  deviceId: string,
  ts: number,
  type: string,
): Promise<boolean> {
  try {
    await db().deviceEvent.create({ data: { deviceId, ts, type } });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function handleDeviceEvent(
  device: { id: string; elderId: string | null },
  type: DeviceEventType,
  now = new Date(),
): Promise<DeviceResult> {
  await db().device.update({
    where: { id: device.id },
    data: { lastHeartbeatAt: now, status: 'ONLINE' },
  });

  const { elderId } = device;
  if (type === 'HEARTBEAT' || !elderId) return { outboundIds: [] };

  if (type === 'FALL' || type === 'LONG_STAY') {
    return openIncident({ elderId, deviceId: device.id, type, now });
  }

  const open = await db().incident.findFirst({
    where: { elderId, status: { in: [...OPEN_STATES] } },
    select: { id: true },
  });

  const outboundIds: string[] = [];
  let incidentId = open?.id;
  if (!incidentId) {
    // Nothing else makes sense without an incident: "ไม่เป็นไร" on its own is
    // not an event worth recording, but "ช่วยด้วย" always is.
    if (type !== 'VOICE_HELP') return { outboundIds };
    const opened = await openIncident({
      elderId,
      deviceId: device.id,
      type: 'VOICE_HELP',
      now,
    });
    incidentId = opened.incidentId;
    outboundIds.push(...opened.outboundIds);
  }

  const result = await applyEvent(incidentId, () => ({ type }), { now });
  if (result.ok) outboundIds.push(...result.outboundIds);
  return { incidentId, outboundIds };
}
