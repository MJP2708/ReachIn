import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { SOMSRI } from '@/lib/demo/seed';
import { handleDeviceEvent } from '@/lib/device/events';
import { pointNorthOf } from '@/lib/geo';
import {
  acceptIncident,
  arriveAtIncident,
  declineIncident,
  familyClose,
  saveGuide,
  submitSummary,
} from '@/lib/incident/service';
import { runTick } from '@/lib/incident/tick';
import { HttpError } from '@/lib/http-error';
import { DAENG, DAUGHTER, DEVICE_ID, NID, OI, SOMCHAI, fall, outbound, resetDb, templates } from '../helpers';

const device = { id: DEVICE_ID, elderId: SOMSRI };
const HOME = { lat: 13.7465, lng: 100.4825 };
const MINUTE = 60_000;

const status = async (id: string) =>
  (await db().incident.findUniqueOrThrow({ where: { id } })).status;

beforeEach(resetDb);

describe('opening an incident', () => {
  it('alerts available helpers and family in one go, and writes the audit log', async () => {
    const { incidentId, created } = await fall();
    expect(created).toBe(true);
    expect(await status(incidentId)).toBe('ALERTING');
    expect(await templates(incidentId)).toEqual(['alert', 'family.searching']);

    const [alert] = await outbound(incidentId);
    expect(alert!.recipientUserIds.sort()).toEqual([DAENG, NID, OI, SOMCHAI].sort());

    const events = await db().incidentEvent.findMany({ where: { incidentId }, orderBy: { createdAt: 'asc' } });
    expect(events.map((event) => event.kind)).toEqual(['DETECTED', 'START_ALERT']);
  });

  it('adds a note instead of a second incident', async () => {
    const first = await fall();
    const second = await fall();
    expect(second).toMatchObject({ incidentId: first.incidentId, created: false });
    expect(await db().incident.count({ where: { elderId: SOMSRI, status: 'ALERTING' } })).toBe(1);
    expect(await db().incidentEvent.count({ where: { incidentId: first.incidentId, kind: 'DUPLICATE_DETECTION' } })).toBe(1);
  });

  it('the database refuses a second open incident even if the app is bypassed', async () => {
    await fall();
    await expect(
      db().incident.create({ data: { elderId: SOMSRI, type: 'FALL', status: 'ALERTING' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('concurrent falls still produce one incident', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => fall()));
    expect(new Set(results.map((result) => result.incidentId)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
  });

  it('skips helpers who are unavailable', async () => {
    await db().user.update({ where: { id: NID }, data: { availability: false } });
    await db().user.update({ where: { id: OI }, data: { availabilityUntil: new Date(Date.now() - 1000) } });
    const { incidentId } = await fall();
    const [alert] = await outbound(incidentId);
    expect(alert!.recipientUserIds.sort()).toEqual([DAENG, SOMCHAI].sort());
  });

  it('leaves out BACKUP when the family has switched it off', async () => {
    await db().elder.update({ where: { id: SOMSRI }, data: { backupEnabled: false } });
    const { incidentId } = await fall();
    const [alert] = await outbound(incidentId);
    expect(alert!.recipientUserIds.sort()).toEqual([DAENG, SOMCHAI].sort());
  });

  it('escalates straight away when nobody can be alerted', async () => {
    await db().user.updateMany({ where: { id: { in: [SOMCHAI, DAENG, NID, OI] } }, data: { availability: false } });
    const { incidentId } = await fall();
    const incident = await db().incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(incident.escalated).toBe(true);
    expect(await templates(incidentId)).toContain('escalation.NO_HELPERS');
  });
});

describe('accepting', () => {
  it('ten simultaneous accepts: exactly one winner, nine on standby', async () => {
    const { incidentId } = await fall();
    const others = Array.from({ length: 10 }, (_, index) => `race-${index}`);
    await db().user.createMany({
      data: others.map((id) => ({ id, lineUserId: `U-${id}`, displayName: id, isDemo: true })),
    });
    await db().circleMember.createMany({
      data: others.map((userId) => ({ elderId: SOMSRI, userId, role: 'INNER' as const })),
    });

    const results = await Promise.all(others.map((id) => acceptIncident(incidentId, id)));

    const winners = results.filter((result) => result.outcome === 'won');
    expect(winners).toHaveLength(1);
    expect(results.filter((result) => result.outcome === 'lost')).toHaveLength(9);

    const incident = await db().incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(incident.status).toBe('ACCEPTED');
    expect(others).toContain(incident.acceptedById);
    expect(await db().incidentEvent.count({ where: { incidentId, kind: 'ACCEPT' } })).toBe(1);
    expect((await templates(incidentId)).filter((t) => t === 'standby.taken')).toHaveLength(1);

    await db().circleMember.deleteMany({ where: { userId: { in: others } } });
    await db().user.deleteMany({ where: { id: { in: others } } });
  });

  it('tells standby, family and the key holder', async () => {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, SOMCHAI, { replyToken: 'reply-token' });

    const messages = await outbound(incidentId);
    const by = (template: string) => messages.find((message) => message.template === template)!;
    expect(by('accepted').recipientUserIds).toEqual([SOMCHAI]);
    expect(by('accepted').replyToken).toBe('reply-token');
    expect(by('standby.taken').recipientUserIds.sort()).toEqual([NID, OI].sort());
    expect(by('family.going').recipientUserIds).toEqual([DAUGHTER]);
    expect(by('key').recipientUserIds).toEqual([DAENG]);
  });

  it('refuses someone outside the circle', async () => {
    const { incidentId } = await fall();
    await db().user.create({ data: { id: 'stranger', lineUserId: 'U-stranger', displayName: 'x' } });
    await expect(acceptIncident(incidentId, 'stranger')).rejects.toBeInstanceOf(HttpError);
    expect(await status(incidentId)).toBe('ALERTING');
  });

  it('family cannot take the job', async () => {
    const { incidentId } = await fall();
    await expect(acceptIncident(incidentId, DAUGHTER)).rejects.toBeInstanceOf(HttpError);
  });
});

describe('arrival check', () => {
  async function accepted() {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, SOMCHAI);
    return incidentId;
  }

  it('accepts 50 m away', async () => {
    const incidentId = await accepted();
    const result = await arriveAtIncident(incidentId, SOMCHAI, pointNorthOf(HOME, 50));
    expect(result.ok).toBe(true);
    expect(await status(incidentId)).toBe('ARRIVED');
    expect(await templates(incidentId)).toEqual(expect.arrayContaining(['standby.arrived', 'family.arrived']));
  });

  it('rejects 500 m away and stays ACCEPTED', async () => {
    const incidentId = await accepted();
    const result = await arriveAtIncident(incidentId, SOMCHAI, pointNorthOf(HOME, 500));
    expect(result).toEqual({ ok: false, distanceM: 500, radiusM: 100 });
    expect(await status(incidentId)).toBe('ACCEPTED');
  });

  it('only the accepter can arrive', async () => {
    const incidentId = await accepted();
    await expect(arriveAtIncident(incidentId, DAENG, HOME)).rejects.toBeInstanceOf(HttpError);
  });

  it('never stores the position', async () => {
    const incidentId = await accepted();
    await arriveAtIncident(incidentId, SOMCHAI, pointNorthOf(HOME, 500));
    const events = await db().incidentEvent.findMany({ where: { incidentId } });
    expect(JSON.stringify(events)).not.toContain('13.7');
  });
});

describe('voice and radar through the device handler', () => {
  it('VOICE_OK on the floor does not cancel', async () => {
    const { incidentId } = await fall();
    await handleDeviceEvent(device, 'VOICE_OK');
    expect(await status(incidentId)).toBe('ALERTING');
    expect(await templates(incidentId)).not.toContain('family.cancelled');
  });

  it.each([
    ['VOICE_OK', 'STANDING'],
    ['STANDING', 'VOICE_OK'],
  ] as const)('%s then %s cancels and tells helpers and family', async (first, second) => {
    const { incidentId } = await fall();
    await handleDeviceEvent(device, first);
    expect(await status(incidentId)).toBe('ALERTING');
    await handleDeviceEvent(device, second);
    expect(await status(incidentId)).toBe('CANCELLED_SELF');

    const list = await templates(incidentId);
    expect(list).toEqual(expect.arrayContaining(['cancelled', 'family.cancelled']));
    const family = (await outbound(incidentId)).find((m) => m.template === 'family.cancelled')!;
    expect(JSON.stringify(family.messages)).toContain('แม่ล้มแต่ลุกได้เอง ไม่บาดเจ็บ ลองโทรหาแม่หน่อยนะ');
  });

  it('a new fall can open after the last one closed', async () => {
    const { incidentId } = await fall();
    await handleDeviceEvent(device, 'VOICE_OK');
    await handleDeviceEvent(device, 'STANDING');
    const next = await fall();
    expect(next.created).toBe(true);
    expect(next.incidentId).not.toBe(incidentId);
  });

  it('NO_RESPONSE escalates with a 1669 button for everyone', async () => {
    const { incidentId } = await fall();
    await handleDeviceEvent(device, 'NO_RESPONSE');
    const incident = await db().incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(incident.status).toBe('ALERTING');
    expect(incident.escalated).toBe(true);
    const messages = await outbound(incidentId);
    const escalations = messages.filter((m) => m.template.startsWith('escalation.NO_RESPONSE'));
    expect(escalations).toHaveLength(2);
    for (const message of escalations) expect(JSON.stringify(message.messages)).toContain('tel:1669');
  });

  it('VOICE_HELP with nothing open starts an incident and escalates it', async () => {
    const { incidentId, outboundIds } = await handleDeviceEvent(device, 'VOICE_HELP');
    expect(outboundIds.length).toBeGreaterThan(2);
    const incident = await db().incident.findUniqueOrThrow({ where: { id: incidentId! } });
    expect(incident.type).toBe('VOICE_HELP');
    expect(incident.escalated).toBe(true);
  });

  it('LONG_STAY opens an incident', async () => {
    const { created } = await handleDeviceEvent(device, 'LONG_STAY');
    expect(created).toBe(true);
  });

  it('VOICE_OK with nothing open does nothing', async () => {
    const result = await handleDeviceEvent(device, 'VOICE_OK');
    expect(result).toEqual({ outboundIds: [] });
  });
});

describe('timers', () => {
  it('reopens a job the accepter never reached, without them', async () => {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, SOMCHAI);

    const now = new Date(Date.now() + 11 * MINUTE);
    expect((await runTick({ now })).reopened).toBe(1);

    const incident = await db().incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(incident.status).toBe('ALERTING');
    expect(incident.acceptedById).toBeNull();
    const realert = (await outbound(incidentId)).find((m) => m.template === 'realert')!;
    expect(realert.recipientUserIds).not.toContain(SOMCHAI);
    expect(realert.recipientUserIds.sort()).toEqual([DAENG, NID, OI].sort());
    expect(await db().incidentEvent.count({ where: { incidentId, kind: 'ARRIVAL_TIMEOUT' } })).toBe(1);
  });

  it('does not reopen before the timeout', async () => {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, SOMCHAI);
    await runTick({ now: new Date(Date.now() + 9 * MINUTE) });
    expect(await status(incidentId)).toBe('ACCEPTED');
  });

  it('escalates once with a 1669 button and places no call', async () => {
    const { incidentId } = await fall();
    const now = new Date(Date.now() + 4 * MINUTE);
    expect((await runTick({ now })).escalated).toBe(1);
    expect((await runTick({ now })).escalated).toBe(0);

    const incident = await db().incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(incident.status).toBe('ALERTING');
    expect(incident.escalated).toBe(true);
    const list = await templates(incidentId);
    expect(list.filter((t) => t === 'escalation.NO_ACCEPT')).toHaveLength(1);
    expect(list.filter((t) => t === 'escalation.NO_ACCEPT.family')).toHaveLength(1);
    const message = (await outbound(incidentId)).find((m) => m.template === 'escalation.NO_ACCEPT')!;
    expect(JSON.stringify(message.messages)).toContain('"uri":"tel:1669"');
  });

  it('marks a silent device offline and tells the family once', async () => {
    await db().device.update({
      where: { id: DEVICE_ID },
      data: { lastHeartbeatAt: new Date(Date.now() - 20 * MINUTE) },
    });
    await db().device.update({ where: { id: 'demo-device-prayoon' }, data: { lastHeartbeatAt: new Date() } });
    expect((await runTick()).devicesOffline).toBe(1);
    expect((await runTick()).devicesOffline).toBe(0);
    const device = await db().device.findUniqueOrThrow({ where: { id: DEVICE_ID } });
    expect(device.status).toBe('OFFLINE');
    const alerts = await db().outboundMessage.findMany({ where: { template: 'device.offline' } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.recipientUserIds).toEqual([DAUGHTER]);
    expect(JSON.stringify(alerts[0]!.messages)).toContain('อุปกรณ์ขาดการเชื่อมต่อ');
  });

  it('a heartbeat brings the device back', async () => {
    await db().device.update({ where: { id: DEVICE_ID }, data: { status: 'OFFLINE' } });
    await handleDeviceEvent(device, 'HEARTBEAT');
    expect((await db().device.findUniqueOrThrow({ where: { id: DEVICE_ID } })).status).toBe('ONLINE');
  });

  it('demoOnly never touches a real elder', async () => {
    await db().elder.update({ where: { id: SOMSRI }, data: { isDemo: false } });
    const { incidentId } = await fall();
    await runTick({ now: new Date(Date.now() + 60 * MINUTE), demoOnly: true });
    expect((await db().incident.findUniqueOrThrow({ where: { id: incidentId } })).escalated).toBe(false);
  });
});

describe('declines', () => {
  it('escalates early once every available helper has declined', async () => {
    const { incidentId } = await fall();
    for (const id of [SOMCHAI, DAENG, NID]) await declineIncident(incidentId, id);
    expect((await db().incident.findUniqueOrThrow({ where: { id: incidentId } })).escalated).toBe(false);
    await declineIncident(incidentId, OI);
    expect((await db().incident.findUniqueOrThrow({ where: { id: incidentId } })).escalated).toBe(true);
    expect(await templates(incidentId)).toContain('escalation.ALL_DECLINED');
  });
});

describe('finishing', () => {
  async function arrived() {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, SOMCHAI);
    await arriveAtIncident(incidentId, SOMCHAI, HOME);
    return incidentId;
  }

  it('summary resolves and sends the family the outcome and the note', async () => {
    const incidentId = await arrived();
    await submitSummary(incidentId, SOMCHAI, { result: 'OK', checklist: ['ดื่มน้ำ'], note: 'นั่งพักอยู่' });
    const incident = await db().incident.findUniqueOrThrow({ where: { id: incidentId }, include: { summary: true } });
    expect(incident.status).toBe('RESOLVED');
    expect(incident.outcome).toBe('OK');
    expect(incident.resolvedAt).not.toBeNull();
    expect(incident.summary?.note).toBe('นั่งพักอยู่');
    const message = (await outbound(incidentId)).find((m) => m.template === 'family.summary')!;
    const body = JSON.stringify(message.messages);
    expect(body).toContain('นั่งพักอยู่');
    expect(body).toContain('ลุกได้ ไม่บาดเจ็บ');
    expect(body).toContain('tel:0800000011');
  });

  it('only the accepter can submit', async () => {
    const incidentId = await arrived();
    await expect(
      submitSummary(incidentId, DAENG, { result: 'OK', checklist: [], note: '' }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('saves guide progress and tells the family about EMS once', async () => {
    const incidentId = await arrived();
    const progress = { step: 2, safetyChecks: [], redFlags: ['x'], moves: [], watchChecks: [], emsTriggered: true };
    await saveGuide(incidentId, SOMCHAI, progress);
    await saveGuide(incidentId, SOMCHAI, progress);
    const guide = await db().guideProgress.findUniqueOrThrow({ where: { incidentId } });
    expect(guide.step).toBe(2);
    expect(guide.emsTriggered).toBe(true);
    expect((await templates(incidentId)).filter((t) => t === 'family.ems')).toHaveLength(1);
  });

  it('family can close a stuck incident, and only family', async () => {
    const { incidentId } = await fall();
    await expect(familyClose(incidentId, SOMCHAI)).rejects.toBeInstanceOf(HttpError);
    await familyClose(incidentId, DAUGHTER);
    expect(await status(incidentId)).toBe('CLOSED_BY_FAMILY');
    expect(await templates(incidentId)).toContain('closed');
    expect((await fall()).created).toBe(true);
  });
});
