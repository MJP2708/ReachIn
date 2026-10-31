import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { requireDemo } from '@/lib/demo/guard';
import { OPEN_STATES } from '@/lib/incident/machine';
import { parseCard, type LineMessage } from '@/lib/line/flex';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHAT_LENGTH = 30;

/** What this person's LINE chat would hold: their queued messages, in order. */
export const GET = route(async (req) => {
  requireDemo(req);
  const user = await requireUser(req);
  const rows = await db().outboundMessage.findMany({
    where: { isDemo: true, recipientUserIds: { has: user.id } },
    orderBy: { createdAt: 'desc' },
    take: CHAT_LENGTH,
  });

  const open = await db().incident.findFirst({
    where: { elder: { isDemo: true }, status: { in: [...OPEN_STATES] } },
    orderBy: { detectedAt: 'desc' },
    select: { id: true, elder: { select: { name: true } } },
  });

  return NextResponse.json({
    open: open && { id: open.id, elderName: open.elder.name },
    messages: rows.reverse().flatMap((row) =>
      (row.messages as unknown as LineMessage[]).flatMap((message, index) => {
        const card = parseCard(message);
        return card
          ? [{ id: `${row.id}-${index}`, at: row.createdAt, card }]
          : [];
      }),
    ),
  });
});
