import { Prisma } from '@/lib/generated/prisma/client';
import type { CircleRole, IncidentType, SummaryResult } from '@/lib/generated/prisma/client';
import { db, type Tx } from '@/lib/db';
import { env } from '@/lib/env';
import { haversineMetres, type LatLng } from '@/lib/geo';
import { HttpError } from '@/lib/http-error';
import { isUniqueViolation } from '@/lib/db/errors';
import { isAvailable } from '@/lib/user';
import {
  planMessages,
  type DispatchContext,
  type OutboundDraft,
} from './dispatcher';
import {
  OPEN_STATES,
  transition,
  type MachineEvent,
  type Snapshot,
  type TransitionError,
} from './machine';

/** A report from a person doesn't say which room. */
export const DEFAULT_ROOM = 'บ้าน';

const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

export const RESULT_LABEL: Record<SummaryResult, string> = {
  OK: 'ลุกได้ ไม่บาดเจ็บ',
  MINOR_INJURY: 'บาดเจ็บเล็กน้อย',
  EMS_CALLED: 'โทร 1669 แล้ว',
};

type Loaded = NonNullable<Awaited<ReturnType<typeof loadLocked>>>;

type Options = {
  actorUserId?: string;
  replyToken?: string;
  payload?: Record<string, Prisma.InputJsonValue>;
  summary?: DispatchContext['summary'];
  now?: Date;
};

export type ApplyResult =
  | { ok: true; outboundIds: string[]; incident: Loaded }
  | { ok: false; error: TransitionError };

/** The row lock serialises every event on an incident, so facts never race. */
async function loadLocked(tx: Tx, incidentId: string) {
  await tx.$queryRaw`SELECT id FROM "Incident" WHERE id = ${incidentId} FOR UPDATE`;
  return tx.incident.findUnique({
    where: { id: incidentId },
    include: {
      device: { select: { room: true } },
      acceptedBy: { select: { id: true, displayName: true } },
      elder: {
        include: {
          circle: {
            where: { active: true },
            include: {
              user: {
                select: {
                  id: true,
                  availability: true,
                  availabilityUntil: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

function circleOf(incident: Loaded, now: Date) {
  const { circle, backupEnabled } = incident.elder;
  const helpers = circle.filter(
    (member) =>
      member.role === 'INNER' || (member.role === 'BACKUP' && backupEnabled),
  );
  return {
    all: helpers.map((member) => member.userId),
    available: helpers
      .filter((member) => isAvailable(member.user, now))
      .map((member) => member.userId),
    family: circle
      .filter((member) => member.role === 'FAMILY')
      .map((member) => member.userId),
    keyHolders: circle
      .filter((member) => member.hasKey)
      .map((member) => member.userId),
    roleOf: (userId: string): CircleRole | undefined =>
      circle.find((member) => member.userId === userId)?.role,
  };
}

function snapshotOf(incident: Loaded): Snapshot {
  return {
    state: incident.status,
    escalated: incident.escalated,
    voiceOk: incident.voiceOkAt !== null,
    standing: incident.standingAt !== null,
    voiceHelp: incident.voiceHelpAt !== null,
  };
}

function patchFor(
  event: MachineEvent,
  incident: Loaded,
  now: Date,
): Prisma.IncidentUpdateInput {
  switch (event.type) {
    case 'START_ALERT':
      return { alertingAt: now };
    case 'ACCEPT':
      return {
        acceptedBy: { connect: { id: event.userId } },
        acceptedAt: now,
      };
    case 'DECLINE':
      return { declinedUserIds: { push: event.userId } };
    case 'ARRIVE':
      return { arrivedAt: now };
    case 'ARRIVAL_TIMEOUT':
      return {
        acceptedBy: { disconnect: true },
        acceptedAt: null,
        alertingAt: now,
        declinedUserIds: [],
      };
    case 'VOICE_OK':
      return { voiceOkAt: incident.voiceOkAt ?? now };
    case 'STANDING':
      return { standingAt: incident.standingAt ?? now };
    case 'VOICE_HELP':
      return { voiceHelpAt: incident.voiceHelpAt ?? now };
    case 'NO_RESPONSE':
      return { noResponseAt: incident.noResponseAt ?? now };
    case 'SUBMIT_SUMMARY':
      return { resolvedAt: now };
    default:
      return {};
  }
}

const union = (...lists: string[][]) => [...new Set(lists.flat())];

async function enqueue(
  tx: Tx,
  incident: Loaded,
  drafts: OutboundDraft[],
  replyToken: string | undefined,
): Promise<string[]> {
  const ids: string[] = [];
  for (const draft of drafts) {
    const { id } = await tx.outboundMessage.create({
      data: {
        incidentId: incident.id,
        template: draft.template,
        audience: draft.audience,
        recipientUserIds: draft.recipientUserIds,
        messages: draft.messages as unknown as Prisma.InputJsonValue,
        replyToken: draft.useReplyToken ? replyToken : undefined,
        isDemo: incident.elder.isDemo,
      },
      select: { id: true },
    });
    ids.push(id);
  }
  return ids;
}

/**
 * The single place incident status changes. Runs inside a transaction holding
 * the row lock: load, ask the machine, persist, write the audit row, and queue
 * the messages, so either all of it happened or none of it did.
 */
async function applyInTx(
  tx: Tx,
  incidentId: string,
  build: (incident: Loaded, circle: ReturnType<typeof circleOf>) => MachineEvent,
  options: Options = {},
): Promise<ApplyResult> {
  const now = options.now ?? new Date();
  const incident = await loadLocked(tx, incidentId);
  if (!incident) throw new HttpError(404, 'ไม่พบเหตุการณ์นี้');

  const circle = circleOf(incident, now);
  const event = build(incident, circle);
  const result = transition(snapshotOf(incident), event);
  if (!result.ok) return { ok: false, error: result.error };

  const alertsEveryone = result.sideEffects.some(
    (effect) => effect.kind === 'notifyEscalation',
  );
  const startsAlert = event.type === 'START_ALERT';
  const alertedUserIds = union(
    incident.alertedUserIds,
    startsAlert || event.type === 'ARRIVAL_TIMEOUT' ? circle.available : [],
    alertsEveryone ? circle.all : [],
  ).filter((id) =>
    event.type === 'ARRIVAL_TIMEOUT' ? id !== event.previousAccepterId : true,
  );

  const updated = await tx.incident.update({
    where: { id: incident.id },
    data: {
      ...patchFor(event, incident, now),
      status: result.nextState,
      escalated: result.escalated,
      alertedUserIds,
    },
    include: { acceptedBy: { select: { id: true, displayName: true } } },
  });

  await tx.incidentEvent.create({
    data: {
      incidentId: incident.id,
      kind: event.type,
      actorUserId: options.actorUserId,
      payload: {
        from: incident.status,
        to: result.nextState,
        escalated: result.escalated,
        ...options.payload,
      },
    },
  });

  const context: DispatchContext = {
    incidentId: incident.id,
    nextState: result.nextState,
    type: incident.type,
    escalated: result.escalated,
    room: incident.device?.room ?? DEFAULT_ROOM,
    detectedAt: incident.detectedAt,
    arrivedAt: updated.arrivedAt,
    elder: {
      name: incident.elder.name,
      title: incident.elder.title,
      familyTerm: incident.elder.familyTerm,
      phone: incident.elder.phone,
    },
    accepter: updated.acceptedBy ?? incident.acceptedBy,
    helpers: {
      available: circle.available,
      all: circle.all,
      alerted: alertedUserIds,
    },
    familyIds: circle.family,
    keyHolderIds: circle.keyHolders,
    summary: options.summary,
  };

  // From the LIFF screen the accepter is already looking at the next step, so
  // a push would spend quota to say what they can see.
  const effects = options.replyToken
    ? result.sideEffects
    : result.sideEffects.filter((effect) => effect.kind !== 'replyAccepter');

  const outboundIds = await enqueue(
    tx,
    incident,
    planMessages(effects, context),
    options.replyToken,
  );
  return {
    ok: true,
    outboundIds,
    incident: { ...incident, ...updated, elder: incident.elder },
  };
}

export function applyEvent(
  incidentId: string,
  build: Parameters<typeof applyInTx>[2],
  options?: Options,
): Promise<ApplyResult> {
  return db().$transaction(
    (tx) => applyInTx(tx, incidentId, build, options),
    TX_OPTIONS,
  );
}

async function appendEvent(
  incidentId: string,
  kind: string,
  payload: Record<string, Prisma.InputJsonValue> = {},
  actorUserId?: string,
) {
  await db().incidentEvent.create({
    data: { incidentId, kind, payload, actorUserId },
  });
}

const findOpenIncident = (elderId: string) =>
  db().incident.findFirst({
    where: { elderId, status: { in: [...OPEN_STATES] } },
    select: { id: true },
  });

export type OpenResult = {
  incidentId: string;
  created: boolean;
  outboundIds: string[];
};

/**
 * Create an incident and start alerting, in one transaction. A second detection
 * for an elder with an open incident becomes a note on that incident; the
 * partial unique index settles the case where two detections race.
 */
export async function openIncident(params: {
  elderId: string;
  deviceId: string | null;
  type: IncidentType;
  now?: Date;
}): Promise<OpenResult> {
  const { elderId, deviceId, type } = params;
  const now = params.now ?? new Date();

  const noteOn = async (incidentId: string): Promise<OpenResult> => {
    await appendEvent(incidentId, 'DUPLICATE_DETECTION', { type });
    return { incidentId, created: false, outboundIds: [] };
  };

  const existing = await findOpenIncident(elderId);
  if (existing) return noteOn(existing.id);

  try {
    return await db().$transaction(async (tx) => {
      const { id } = await tx.incident.create({
        data: { elderId, deviceId, type, detectedAt: now },
        select: { id: true },
      });
      await tx.incidentEvent.create({
        data: { incidentId: id, kind: 'DETECTED', payload: { type } },
      });
      const result = await applyInTx(
        tx,
        id,
        (_incident, circle) => ({
          type: 'START_ALERT',
          helperCount: circle.available.length,
        }),
        { now },
      );
      if (!result.ok) throw new Error(`could not start alert: ${result.error}`);
      return { incidentId: id, created: true, outboundIds: result.outboundIds };
    }, TX_OPTIONS);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await findOpenIncident(elderId);
    if (!winner) throw error;
    return noteOn(winner.id);
  }
}

export type AcceptResult =
  | { outcome: 'won'; outboundIds: string[] }
  | { outcome: 'lost'; accepterName: string | null };

/** Exactly one concurrent caller wins: the row lock orders them. */
export async function acceptIncident(
  incidentId: string,
  userId: string,
  options: { replyToken?: string; now?: Date } = {},
): Promise<AcceptResult> {
  const result = await db().$transaction(async (tx) => {
    const member = await tx.circleMember.findFirst({
      where: {
        userId,
        active: true,
        elder: { incidents: { some: { id: incidentId } } },
      },
      include: { elder: { select: { backupEnabled: true } } },
    });
    const helper =
      member?.role === 'INNER' ||
      (member?.role === 'BACKUP' && member.elder.backupEnabled);
    if (!helper) throw new HttpError(404, 'ไม่พบเหตุการณ์นี้');

    return applyInTx(tx, incidentId, () => ({ type: 'ACCEPT', userId }), {
      ...options,
      actorUserId: userId,
    });
  }, TX_OPTIONS);

  if (result.ok) return { outcome: 'won', outboundIds: result.outboundIds };

  const incident = await db().incident.findUnique({
    where: { id: incidentId },
    select: { acceptedBy: { select: { displayName: true } } },
  });
  return {
    outcome: 'lost',
    accepterName: incident?.acceptedBy?.displayName ?? null,
  };
}

export async function declineIncident(incidentId: string, userId: string) {
  return applyEvent(
    incidentId,
    (incident, circle) => {
      if (!circle.all.includes(userId)) {
        throw new HttpError(404, 'ไม่พบเหตุการณ์นี้');
      }
      const declined = new Set([...incident.declinedUserIds, userId]);
      return {
        type: 'DECLINE',
        userId,
        allDeclined: circle.available.every((id) => declined.has(id)),
      };
    },
    { actorUserId: userId },
  );
}

/** A key-holder's yes changes no state, so it is only an audit row and a push. */
export async function confirmKey(incidentId: string, userId: string) {
  const incident = await db().incident.findUnique({
    where: { id: incidentId },
    select: {
      acceptedById: true,
      elder: {
        select: {
          isDemo: true,
          circle: { where: { userId, hasKey: true, active: true } },
        },
      },
    },
  });
  if (!incident?.elder.circle.length) {
    throw new HttpError(404, 'ไม่พบเหตุการณ์นี้');
  }
  await appendEvent(incidentId, 'KEY_CONFIRMED', {}, userId);
  return incident;
}

export type ArriveResult =
  | { ok: true; outboundIds: string[] }
  | { ok: false; distanceM: number; radiusM: number };

export async function arriveAtIncident(
  incidentId: string,
  userId: string,
  position: LatLng,
  options: { now?: Date } = {},
): Promise<ArriveResult> {
  const incident = await db().incident.findUnique({
    where: { id: incidentId },
    select: {
      acceptedById: true,
      status: true,
      elder: { select: { lat: true, lng: true } },
    },
  });
  if (!incident || incident.acceptedById !== userId) {
    throw new HttpError(404, 'ไม่พบงานนี้');
  }

  const radiusM = env().ARRIVAL_RADIUS_M;
  const distanceM = Math.round(haversineMetres(position, incident.elder));
  if (distanceM > radiusM) {
    // The position itself is never stored, only how far off it was.
    await appendEvent(incidentId, 'ARRIVAL_REJECTED', { distanceM }, userId);
    return { ok: false, distanceM, radiusM };
  }

  const result = await applyEvent(incidentId, () => ({ type: 'ARRIVE' }), {
    actorUserId: userId,
    payload: { distanceM },
    now: options.now,
  });
  if (!result.ok) throw new HttpError(409, 'งานนี้เปลี่ยนสถานะไปแล้ว');
  return { ok: true, outboundIds: result.outboundIds };
}

export async function submitSummary(
  incidentId: string,
  userId: string,
  input: { result: SummaryResult; checklist: string[]; note: string },
): Promise<string[]> {
  const outcome = await db().$transaction(async (tx) => {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId },
      select: { acceptedById: true },
    });
    if (!incident || incident.acceptedById !== userId) {
      throw new HttpError(404, 'ไม่พบงานนี้');
    }
    const applied = await applyInTx(
      tx,
      incidentId,
      () => ({ type: 'SUBMIT_SUMMARY' }),
      {
        actorUserId: userId,
        payload: { result: input.result },
        summary: { resultLabel: RESULT_LABEL[input.result], note: input.note },
      },
    );
    if (!applied.ok) return applied;
    await tx.summary.create({ data: { incidentId, ...input } });
    await tx.incident.update({
      where: { id: incidentId },
      data: { outcome: input.result },
    });
    return applied;
  }, TX_OPTIONS);

  if (!outcome.ok) throw new HttpError(409, 'ส่งสรุปไม่ได้ในสถานะนี้');
  return outcome.outboundIds;
}

export async function saveGuide(
  incidentId: string,
  userId: string,
  input: {
    step: number;
    safetyChecks: string[];
    redFlags: string[];
    moves: string[];
    watchChecks: string[];
    emsTriggered: boolean;
  },
): Promise<string[]> {
  const incident = await db().incident.findUnique({
    where: { id: incidentId },
    select: { acceptedById: true },
  });
  if (!incident || incident.acceptedById !== userId) {
    throw new HttpError(404, 'ไม่พบงานนี้');
  }

  await db().guideProgress.upsert({
    where: { incidentId },
    create: { incidentId, ...input },
    update: input,
  });
  if (!input.emsTriggered) return [];

  const result = await applyEvent(
    incidentId,
    () => ({ type: 'EMS_TRIGGERED' }),
    { actorUserId: userId },
  );
  return result.ok ? result.outboundIds : [];
}

export async function familyClose(incidentId: string, userId: string) {
  const result = await applyEvent(
    incidentId,
    (_incident, circle) => {
      if (circle.roleOf(userId) !== 'FAMILY') {
        throw new HttpError(404, 'ไม่พบเหตุการณ์นี้');
      }
      return { type: 'FAMILY_CLOSE' };
    },
    { actorUserId: userId },
  );
  if (!result.ok) throw new HttpError(409, 'ปิดเหตุการณ์นี้ไม่ได้');
  return result.outboundIds;
}

