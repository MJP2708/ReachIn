import type { CircleRole, User } from '@/lib/generated/prisma/client';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http-error';
import { OPEN_STATES, isOpen } from '@/lib/incident/machine';
import { describeCard, type LineMessage } from '@/lib/line/flex';
import { canSeePrivate } from '@/lib/privacy';
import { minutesBetween, monthKey } from '@/lib/time';

const FALLS_WINDOW_MS = 30 * 86_400_000;
export const WATCH_FALL_COUNT = 2;

const notFound = () => new HttpError(404, 'ไม่พบข้อมูลนี้');

async function membership(userId: string, elderId: string) {
  const member = await db().circleMember.findFirst({
    where: { userId, elderId, active: true },
    select: { role: true },
  });
  if (!member) throw notFound();
  return member;
}

async function acceptsOpenIncident(userId: string, elderId: string) {
  const open = await db().incident.findFirst({
    where: { elderId, acceptedById: userId, status: { in: [...OPEN_STATES] } },
    select: { id: true },
  });
  return open !== null;
}

/** The only reader of medical data. Fields the viewer may not see are absent. */
export async function getElderView(userId: string, elderId: string) {
  const { role } = await membership(userId, elderId);
  const isOpenIncidentAccepter = await acceptsOpenIncident(userId, elderId);
  const showPrivate = canSeePrivate({ role, isOpenIncidentAccepter });

  const elder = await db().elder.findUniqueOrThrow({
    where: { id: elderId },
    include: {
      conditions: true,
      medications: true,
      circle: {
        where: { active: true },
        include: { user: { select: { displayName: true, phone: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  const falls = await db().incident.findMany({
    where: { elderId, type: 'FALL' },
    orderBy: { detectedAt: 'desc' },
    take: 20,
    select: { id: true, detectedAt: true, status: true, outcome: true },
  });
  const recentFalls = falls.filter(
    (fall) => Date.now() - fall.detectedAt.getTime() < FALLS_WINDOW_MS,
  ).length;

  return {
    id: elder.id,
    name: elder.name,
    title: elder.title,
    age: elder.age,
    address: elder.address,
    backupEnabled: elder.backupEnabled,
    viewerRole: role,
    falls,
    recentFalls,
    circle: elder.circle
      .filter((member) => member.role !== 'BACKUP' || elder.backupEnabled)
      .map((member) => ({
        id: member.id,
        role: member.role,
        displayName: member.user.displayName,
        hasKey: showPrivate ? member.hasKey : undefined,
      })),
    private: showPrivate
      ? {
          conditions: elder.conditions.map((condition) => condition.label),
          medications: elder.medications.map((medication) => ({
            id: medication.id,
            name: medication.name,
            schedule: medication.schedule,
            warning: medication.warning,
          })),
          allergies: elder.allergies,
          notes: elder.notes,
        }
      : null,
  };
}

export type ElderView = Awaited<ReturnType<typeof getElderView>>;

export async function getIncidentView(userId: string, incidentId: string) {
  const incident = await db().incident.findUnique({
    where: { id: incidentId },
    include: {
      acceptedBy: { select: { id: true, displayName: true } },
      device: { select: { room: true } },
      guide: true,
      summary: true,
      elder: {
        include: {
          conditions: true,
          medications: true,
          circle: {
            where: { active: true },
            include: { user: { select: { id: true, displayName: true, phone: true } } },
          },
        },
      },
    },
  });
  if (!incident) throw notFound();

  const member = incident.elder.circle.find((m) => m.userId === userId);
  if (!member) throw notFound();

  const open = isOpen(incident.status);
  const isAccepter = incident.acceptedById === userId;
  const showPrivate = canSeePrivate({
    role: member.role,
    isOpenIncidentAccepter: open && isAccepter,
  });

  const { elder } = incident;
  const keyHolder = elder.circle.find((m) => m.hasKey);
  const keyConfirmed = await db().incidentEvent.count({
    where: { incidentId, kind: 'KEY_CONFIRMED' },
  });

  return {
    id: incident.id,
    status: incident.status,
    type: incident.type,
    open,
    escalated: incident.escalated,
    detectedAt: incident.detectedAt,
    acceptedAt: incident.acceptedAt,
    arrivedAt: incident.arrivedAt,
    resolvedAt: incident.resolvedAt,
    outcome: incident.outcome,
    noVoiceAnswer: incident.voiceOkAt === null && incident.voiceHelpAt === null,
    room: incident.device?.room ?? 'ห้องน้ำ',
    viewerRole: member.role,
    isAccepter,
    accepterName: incident.acceptedBy?.displayName ?? null,
    alertedCount: incident.alertedUserIds.length,
    alertedNames: elder.circle
      .filter((m) => incident.alertedUserIds.includes(m.userId))
      .map((m) => m.user.displayName),
    standbyCount: incident.alertedUserIds.filter(
      (id) => id !== incident.acceptedById,
    ).length,
    guide: isAccepter ? incident.guide : null,
    summary: incident.summary,
    elder: {
      name: elder.name,
      title: elder.title,
      familyTerm: elder.familyTerm,
      age: elder.age,
      sex: elder.sex,
      address: elder.address,
      lat: elder.lat,
      lng: elder.lng,
    },
    private: showPrivate
      ? {
          conditions: elder.conditions.map((condition) => condition.label),
          medications: elder.medications.map((medication) => ({
            name: medication.name,
            schedule: medication.schedule,
            warning: medication.warning,
          })),
          notes: elder.notes,
          keyHolder: keyHolder
            ? {
                name: keyHolder.user.displayName,
                phone: keyHolder.user.phone,
                isViewer: keyHolder.userId === userId,
                confirmed: keyConfirmed > 0,
              }
            : null,
        }
      : null,
  };
}

export type IncidentView = Awaited<ReturnType<typeof getIncidentView>>;

export async function getHome(user: User) {
  const memberships = await db().circleMember.findMany({
    where: { userId: user.id, active: true },
    include: {
      elder: {
        select: {
          id: true,
          name: true,
          age: true,
          lat: true,
          lng: true,
          backupEnabled: true,
          incidents: {
            where: {
              type: 'FALL',
              detectedAt: { gte: new Date(Date.now() - FALLS_WINDOW_MS) },
            },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const involved = await db().incident.findMany({
    where: {
      OR: [{ acceptedById: user.id }, { alertedUserIds: { has: user.id } }],
    },
    select: {
      id: true,
      status: true,
      detectedAt: true,
      arrivedAt: true,
      acceptedById: true,
      elderId: true,
    },
  });

  const thisMonth = monthKey(new Date());
  const inMonth = involved.filter(
    (incident) => monthKey(incident.detectedAt) === thisMonth,
  );
  const helped = inMonth.filter(
    (incident) => incident.acceptedById === user.id && incident.arrivedAt,
  );
  const averageArrival = helped.length
    ? Math.round(
        helped.reduce(
          (sum, incident) =>
            sum + minutesBetween(incident.detectedAt, incident.arrivedAt!),
          0,
        ) / helped.length,
      )
    : null;

  const active = involved.find(
    (incident) =>
      isOpen(incident.status) &&
      (incident.acceptedById === user.id || incident.acceptedById === null),
  );

  return {
    stats: {
      helped: helped.length,
      averageArrival,
      standby: inMonth.length - helped.length,
    },
    activeIncidentId: active?.id ?? null,
    elders: memberships
      .filter((m) => m.role !== 'BACKUP' || m.elder.backupEnabled)
      .map((m) => ({
        id: m.elder.id,
        name: m.elder.name,
        age: m.elder.age,
        lat: m.elder.lat,
        lng: m.elder.lng,
        role: m.role,
        recentFalls: m.elder.incidents.length,
      })),
  };
}

export type HistoryKind = 'helped' | 'standby';

export async function getHistory(userId: string) {
  const incidents = await db().incident.findMany({
    where: {
      detectedAt: { gte: sixMonthsAgo() },
      OR: [{ acceptedById: userId }, { alertedUserIds: { has: userId } }],
    },
    orderBy: { detectedAt: 'desc' },
    include: {
      elder: { select: { name: true } },
      device: { select: { room: true } },
      acceptedBy: { select: { displayName: true } },
    },
  });

  return incidents.map((incident) => ({
    id: incident.id,
    elderName: incident.elder.name,
    room: incident.device?.room ?? 'ห้องน้ำ',
    detectedAt: incident.detectedAt,
    status: incident.status,
    outcome: incident.outcome,
    kind: (incident.acceptedById === userId
      ? 'helped'
      : 'standby') satisfies HistoryKind as HistoryKind,
    accepterName: incident.acceptedBy?.displayName ?? null,
    arrivalMinutes: incident.arrivedAt
      ? minutesBetween(incident.detectedAt, incident.arrivedAt)
      : null,
  }));
}

function sixMonthsAgo() {
  const date = new Date();
  date.setMonth(date.getMonth() - 5, 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getNotifications(userId: string) {
  const rows = await db().outboundMessage.findMany({
    where: { recipientUserIds: { has: userId } },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, createdAt: true, messages: true, incidentId: true },
  });
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    incidentId: row.incidentId,
    text: (row.messages as unknown as LineMessage[])
      .map(describeCard)
      .join(' ')
      .replace(/\s·\s\[.*$/, ''),
  }));
}

export const ROLE_LABEL: Record<CircleRole, string> = {
  FAMILY: 'ลูกหลาน',
  INNER: 'วงใน',
  BACKUP: 'วงสำรอง',
};
