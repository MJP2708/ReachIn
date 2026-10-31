import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { card } from '@/lib/line/flex';
import { deliverOutbound, retryPendingOutbound } from './outbox';
import { applyEvent } from './service';

export type TickResult = {
  reopened: number;
  escalated: number;
  devicesOffline: number;
  retried: number;
};

const minutesAgo = (now: Date, minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

/**
 * Run every timer once. `demoOnly` scopes it to seeded elders, because
 * /api/demo/tick fast-forwards the clock and must not touch a real incident.
 */
export async function runTick(
  options: { now?: Date; demoOnly?: boolean } = {},
): Promise<TickResult> {
  const now = options.now ?? new Date();
  const scope = options.demoOnly ? { elder: { isDemo: true } } : {};
  const {
    ARRIVAL_TIMEOUT_MIN,
    NO_ACCEPT_ESCALATE_MIN,
    HEARTBEAT_TIMEOUT_MIN,
  } = env();

  const outboundIds: string[] = [];
  const result: TickResult = {
    reopened: 0,
    escalated: 0,
    devicesOffline: 0,
    retried: 0,
  };

  const overdue = await db().incident.findMany({
    where: {
      ...scope,
      status: 'ACCEPTED',
      acceptedAt: { lt: minutesAgo(now, ARRIVAL_TIMEOUT_MIN) },
    },
    select: { id: true, acceptedById: true },
  });
  for (const { id, acceptedById } of overdue) {
    const applied = await applyEvent(
      id,
      (_incident, circle) => ({
        type: 'ARRIVAL_TIMEOUT',
        previousAccepterId: acceptedById ?? '',
        helperCount: circle.available.filter((user) => user !== acceptedById)
          .length,
      }),
      { now },
    );
    if (applied.ok) {
      result.reopened += 1;
      outboundIds.push(...applied.outboundIds);
    }
  }

  const unanswered = await db().incident.findMany({
    where: {
      ...scope,
      status: 'ALERTING',
      escalated: false,
      alertingAt: { lt: minutesAgo(now, NO_ACCEPT_ESCALATE_MIN) },
    },
    select: { id: true },
  });
  for (const { id } of unanswered) {
    const applied = await applyEvent(
      id,
      () => ({ type: 'NO_ACCEPT_TIMEOUT' }),
      { now },
    );
    if (applied.ok) {
      result.escalated += 1;
      outboundIds.push(...applied.outboundIds);
    }
  }

  const silent = await db().device.findMany({
    where: {
      status: 'ONLINE',
      elderId: { not: null },
      lastHeartbeatAt: { lt: minutesAgo(now, HEARTBEAT_TIMEOUT_MIN) },
      ...(options.demoOnly ? { elder: { isDemo: true } } : {}),
    },
    select: {
      id: true,
      elder: {
        select: {
          isDemo: true,
          circle: {
            where: { role: 'FAMILY', active: true },
            select: { userId: true },
          },
        },
      },
    },
  });
  for (const device of silent) {
    await db().device.update({
      where: { id: device.id },
      data: { status: 'OFFLINE' },
    });
    result.devicesOffline += 1;
    const recipientUserIds = device.elder?.circle.map((m) => m.userId) ?? [];
    if (recipientUserIds.length > 0) {
      const { id } = await db().outboundMessage.create({
        data: {
          template: 'device.offline',
          audience: 'ลูกหลาน',
          recipientUserIds,
          isDemo: device.elder?.isDemo ?? false,
          messages: [
            card('ReachIn: แจ้งเตือนอุปกรณ์', {
              tone: 'urgent',
              eyebrow: 'แจ้งเตือนอุปกรณ์',
              title: 'อุปกรณ์ขาดการเชื่อมต่อ',
              lines: ['ตรวจไฟและอินเทอร์เน็ตของกล่องในห้องน้ำ'],
            }),
          ] as object[],
        },
        select: { id: true },
      });
      outboundIds.push(id);
    }
  }

  await deliverOutbound(outboundIds);
  result.retried = await retryPendingOutbound(now);
  return result;
}
