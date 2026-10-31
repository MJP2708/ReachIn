import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { seedDemo, SOMSRI } from '@/lib/demo/seed';
import { openIncident } from '@/lib/incident/service';
import type {
  MessageTransport,
  SendResult,
} from '@/lib/line/transport';
import type { LineMessage } from '@/lib/line/flex';

export const SOMCHAI = 'demo-somchai'; // INNER for Somsri
export const DAENG = 'demo-daeng'; // INNER, key holder
export const DAUGHTER = 'demo-daughter'; // FAMILY
export const NID = 'demo-nid'; // BACKUP
export const OI = 'demo-oi'; // BACKUP
export const DEVICE_ID = 'demo-device-somsri';

export const flushAfter = () =>
  (globalThis as unknown as { flushAfter: () => Promise<void> }).flushAfter();

export async function resetDb() {
  await db().processedWebhookEvent.deleteMany();
  await db().session.deleteMany();
  await db().user.deleteMany({ where: { isDemo: false } });
  await seedDemo(db());
}

export async function fall(type: 'FALL' | 'LONG_STAY' | 'VOICE_HELP' = 'FALL', now?: Date) {
  return openIncident({ elderId: SOMSRI, deviceId: DEVICE_ID, type, now });
}

export const outbound = (incidentId: string) =>
  db().outboundMessage.findMany({
    where: { incidentId },
    orderBy: { createdAt: 'asc' },
  });

export const templates = async (incidentId: string) =>
  (await outbound(incidentId)).map((message) => message.template);

export function jsonRequest(
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'POST',
    headers: { 'content-type': 'application/json', ...init.headers },
    body:
      init.body === undefined
        ? undefined
        : typeof init.body === 'string'
          ? init.body
          : JSON.stringify(init.body),
  });
}

export const params = <T extends Record<string, string>>(value: T) => ({
  params: Promise.resolve(value),
});

/** Stands in for LINE and records every call. */
export class FakeTransport implements MessageTransport {
  readonly live = true;
  calls: Array<{ kind: 'reply' | 'push' | 'multicast'; to: string | string[]; messages: LineMessage[] }> = [];
  multicastResult: SendResult = { ok: true };
  replyResult: SendResult = { ok: true };

  async reply(token: string, messages: LineMessage[]) {
    this.calls.push({ kind: 'reply', to: token, messages });
    return this.replyResult;
  }

  async push(to: string, messages: LineMessage[]) {
    this.calls.push({ kind: 'push', to, messages });
    return { ok: true } as const;
  }

  async multicast(to: string[], messages: LineMessage[]) {
    this.calls.push({ kind: 'multicast', to, messages });
    return this.multicastResult;
  }
}
