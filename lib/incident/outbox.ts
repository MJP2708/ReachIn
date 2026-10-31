import { createHash } from 'node:crypto';
import type { OutboundMessage } from '@/lib/generated/prisma/client';
import { db } from '@/lib/db';
import type { LineMessage } from '@/lib/line/flex';
import {
  getTransport,
  type MessageTransport,
  type SendContext,
  type SendResult,
} from '@/lib/line/transport';

const MULTICAST_LIMIT = 500;
const MAX_ATTEMPTS = 5;
/** Long enough that a retry cannot overlap a delivery still in `after()`. */
const RETRY_AFTER_MS = 30_000;

/** A stable UUID per chunk or recipient, so a retry cannot double-send. */
function derivedRetryKey(base: string, part: string): string {
  const hex = createHash('sha256').update(`${base}:${part}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * One bad ID makes LINE reject a whole multicast and send to nobody, so a 400
 * falls back to individual pushes: a fall alert reaches everyone it can.
 */
async function sendToAll(
  transport: MessageTransport,
  lineIds: string[],
  messages: LineMessage[],
  retryKey: string,
  context: SendContext,
): Promise<SendResult> {
  let last: SendResult = { ok: true };
  for (const [index, group] of chunks(lineIds, MULTICAST_LIMIT).entries()) {
    const key = derivedRetryKey(retryKey, `chunk-${index}`);
    let result = await (group.length === 1
      ? transport.push(group[0]!, messages, key, context)
      : transport.multicast(group, messages, key, context));

    if (!result.ok && result.status === 400 && group.length > 1) {
      const pushes = await Promise.all(
        group.map((id) =>
          transport.push(
            id,
            messages,
            derivedRetryKey(retryKey, id),
            context,
          ),
        ),
      );
      result = pushes.find((push) => !push.ok) ?? { ok: true };
    }
    if (!result.ok) last = result;
  }
  return last;
}

async function deliverOne(message: OutboundMessage): Promise<void> {
  const transport = getTransport();
  const messages = message.messages as unknown as LineMessage[];
  const context: SendContext = {
    template: message.template,
    incidentId: message.incidentId,
  };

  const users = await db().user.findMany({
    where: { id: { in: message.recipientUserIds } },
    select: { lineUserId: true, isDemo: true },
  });
  // Seeded people have made-up LINE IDs, which LINE would reject outright.
  const reachable = transport.live ? users.filter((user) => !user.isDemo) : users;

  if (reachable.length === 0) {
    await db().outboundMessage.update({
      where: { id: message.id },
      data: {
        status: 'SIMULATED',
        sentAt: new Date(),
        attempts: { increment: 1 },
        replyToken: null,
      },
    });
    return;
  }

  let result: SendResult | undefined;
  if (message.replyToken) {
    result = await transport.reply(message.replyToken, messages, context);
  }
  if (!result?.ok) {
    result = await sendToAll(
      transport,
      reachable.map((user) => user.lineUserId),
      messages,
      message.retryKey,
      context,
    );
  }

  await db().outboundMessage.update({
    where: { id: message.id },
    data: result.ok
      ? {
          status: transport.live ? 'SENT' : 'SIMULATED',
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
          replyToken: null,
        }
      : {
          status: result.retriable ? 'PENDING' : 'FAILED',
          attempts: { increment: 1 },
          lastError: String(result.status ?? 'network'),
          // A reply token works once; retries go by push.
          replyToken: null,
        },
  });
  console.log(
    `[outbox] id=${message.id} template=${message.template} recipients=${reachable.length} ok=${result.ok}`,
  );
}

/**
 * Deliver queued messages. Failures stay in the table, so a LINE outage
 * degrades to the demo feed instead of breaking the flow that queued them.
 */
export async function deliverOutbound(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = await db().outboundMessage.findMany({
    where: { id: { in: ids }, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
  await Promise.all(
    rows.map((row) =>
      deliverOne(row).catch((error: unknown) => {
        console.error(
          `[outbox] id=${row.id} failed: ${(error as Error).name}`,
        );
      }),
    ),
  );
}

export async function retryPendingOutbound(now = new Date()): Promise<number> {
  const rows = await db().outboundMessage.findMany({
    where: {
      status: 'PENDING',
      attempts: { lt: MAX_ATTEMPTS },
      createdAt: { lt: new Date(now.getTime() - RETRY_AFTER_MS) },
    },
    select: { id: true },
    take: 50,
  });
  await deliverOutbound(rows.map((row) => row.id));
  return rows.length;
}
