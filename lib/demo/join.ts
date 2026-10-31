import { db } from '@/lib/db';
import { HttpError } from '@/lib/http-error';
import { demoOpen } from './guard';

const joinable = (incidentId: string) =>
  db().incident.findFirst({
    where: { id: incidentId, elder: { isDemo: true } },
    select: {
      elderId: true,
      alertedUserIds: true,
      elder: { select: { name: true } },
    },
  });

/**
 * Someone opening a shared card is not in the circle yet. A demo elder is
 * fictional, so letting them in exposes nothing; a real elder never qualifies.
 */
export async function demoElderToJoin(userId: string, incidentId: string) {
  if (!demoOpen()) return null;
  const incident = await joinable(incidentId);
  if (!incident) return null;
  const member = await db().circleMember.findFirst({
    where: { userId, elderId: incident.elderId, active: true },
    select: { id: true },
  });
  return member ? null : incident.elder.name;
}

export async function joinDemoIncident(userId: string, incidentId: string) {
  const incident = demoOpen() ? await joinable(incidentId) : null;
  if (!incident) throw new HttpError(404, 'ไม่พบเหตุการณ์นี้');

  await db().circleMember.upsert({
    where: { elderId_userId: { elderId: incident.elderId, userId } },
    create: { elderId: incident.elderId, userId, role: 'INNER' },
    update: { active: true },
  });
  if (!incident.alertedUserIds.includes(userId)) {
    await db().incident.update({
      where: { id: incidentId },
      data: { alertedUserIds: { push: userId } },
    });
  }
}
