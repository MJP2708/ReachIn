import { db } from '@/lib/db';
import { describeCard, type LineMessage } from '@/lib/line/flex';

export type FeedItem = {
  id: string;
  at: string;
  kind: 'event' | 'message';
  label: string;
  detail: string;
  status?: string;
};

export async function getDemoFeed() {
  const incident = await db().incident.findFirst({
    where: { elder: { isDemo: true } },
    // Not createdAt: a reset writes old incidents with a fresh createdAt.
    orderBy: { detectedAt: 'desc' },
    select: {
      id: true,
      status: true,
      escalated: true,
      acceptedById: true,
      elder: { select: { name: true } },
      acceptedBy: { select: { displayName: true } },
      alertedUserIds: true,
    },
  });

  const [events, messages] = await Promise.all([
    db().incidentEvent.findMany({
      where: { incident: { elder: { isDemo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { actor: { select: { displayName: true } } },
    }),
    db().outboundMessage.findMany({
      where: { isDemo: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
  ]);

  const items: FeedItem[] = [
    ...events.map((event) => ({
      id: event.id,
      at: event.createdAt.toISOString(),
      kind: 'event' as const,
      label: event.kind,
      detail: [
        event.actor?.displayName,
        (event.payload as { to?: string }).to,
      ]
        .filter(Boolean)
        .join(' → '),
    })),
    ...messages.map((message) => ({
      id: message.id,
      at: message.createdAt.toISOString(),
      kind: 'message' as const,
      label: `${message.audience} (${message.recipientUserIds.length} คน)`,
      detail: (message.messages as unknown as LineMessage[])
        .map(describeCard)
        .join(' '),
      status: message.status,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    incident: incident && {
      id: incident.id,
      status: incident.status,
      escalated: incident.escalated,
      elderName: incident.elder.name,
      accepterName: incident.acceptedBy?.displayName ?? null,
      alertedCount: incident.alertedUserIds.length,
    },
    items,
  };
}
