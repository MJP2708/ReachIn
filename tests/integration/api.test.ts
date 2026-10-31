import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as authLine } from '@/app/api/auth/line/route';
import { GET as cronGet } from '@/app/api/cron/tick/route';
import { POST as demoLogin } from '@/app/api/demo/login/route';
import { POST as demoEvent } from '@/app/api/demo/event/route';
import { POST as demoActAs } from '@/app/api/demo/act-as/route';
import { POST as deviceEvents } from '@/app/api/device/events/route';
import { GET as elderGet } from '@/app/api/liff/elder/[id]/route';
import { POST as accept } from '@/app/api/liff/incident/[id]/accept/route';
import { POST as arrive } from '@/app/api/liff/incident/[id]/arrive/route';
import { GET as incidentGet } from '@/app/api/liff/incident/[id]/route';
import { POST as availability } from '@/app/api/liff/availability/route';
import { POST as joinInvite } from '@/app/api/liff/invite/[token]/route';
import { POST as webhook } from '@/app/api/line/webhook/route';
import { db } from '@/lib/db';
import { SOMSRI } from '@/lib/demo/seed';
import { DEMO_COOKIE, demoCookieValue } from '@/lib/demo/guard';
import { demoDeviceSecret, signDeviceBody } from '@/lib/device/secret';
import { acceptIncident, familyClose } from '@/lib/incident/service';
import { createInvite } from '@/lib/invites';
import { deliverOutbound, retryPendingOutbound } from '@/lib/incident/outbox';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { setTransportForTests } from '@/lib/line/transport';
import { DAUGHTER, FakeTransport, NID, SOMCHAI, DAENG, fall, flushAfter, jsonRequest, outbound, params, resetDb } from '../helpers';

const SERIAL = 'RI-DEMO-0001';
const SECRET = process.env.LINE_CHANNEL_SECRET!;
const HOME = { lat: 13.7465, lng: 100.4825 };

/** LINE's verify endpoint, mocked: token "line:<sub>" is valid, others are not. */
function mockLineVerify() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const token = new URLSearchParams(String(init.body)).get('id_token') ?? '';
      if (!token.startsWith('line:')) return new Response('{}', { status: 400 });
      return Response.json({
        sub: token.slice(5),
        aud: process.env.LINE_LOGIN_CHANNEL_ID,
        exp: Math.floor(Date.now() / 1000) + 600,
        name: 'จากโทเค็น',
      });
    }),
  );
}

const bearer = (sub: string) => ({ authorization: `Bearer line:${sub}` });
const lineId = (userId: string) => `U-${userId}`;

beforeEach(async () => {
  await resetDb();
  mockLineVerify();
});

afterEach(() => {
  vi.unstubAllGlobals();
  setTransportForTests(undefined);
});

function signedDeviceRequest(
  body: Record<string, unknown>,
  signature?: string,
) {
  const raw = JSON.stringify(body);
  return jsonRequest('/api/device/events', {
    body: raw,
    headers: {
      'x-device-signature': signature ?? signDeviceBody(raw, demoDeviceSecret(SERIAL)),
    },
  });
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
const deviceBody = (type: string, ts = nowSeconds()) => ({ serial: SERIAL, type, ts });

describe('device API', () => {
  it('accepts a signed event and creates an incident', async () => {
    const res = await deviceEvents(signedDeviceRequest(deviceBody('FALL')));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(true);
    await flushAfter();
    expect(await db().incident.count({ where: { id: body.incidentId, status: 'ALERTING' } })).toBe(1);
  });

  it('answers within a second', async () => {
    const started = performance.now();
    await deviceEvents(signedDeviceRequest(deviceBody('FALL')));
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('rejects a bad signature', async () => {
    const res = await deviceEvents(signedDeviceRequest(deviceBody('FALL'), 'ab'.repeat(32)));
    expect(res.status).toBe(401);
    expect(await db().incident.count({ where: { status: 'ALERTING' } })).toBe(0);
  });

  it('rejects a missing signature', async () => {
    const raw = JSON.stringify(deviceBody('FALL'));
    const res = await deviceEvents(jsonRequest('/api/device/events', { body: raw }));
    expect(res.status).toBe(401);
  });

  it('rejects a signature from another device', async () => {
    const raw = JSON.stringify(deviceBody('FALL'));
    const res = await deviceEvents(
      jsonRequest('/api/device/events', {
        body: raw,
        headers: { 'x-device-signature': signDeviceBody(raw, demoDeviceSecret('RI-DEMO-0002')) },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects a body changed after signing', async () => {
    const signature = signDeviceBody(JSON.stringify(deviceBody('HEARTBEAT')), demoDeviceSecret(SERIAL));
    const res = await deviceEvents(signedDeviceRequest(deviceBody('FALL'), signature));
    expect(res.status).toBe(401);
  });

  it('rejects a timestamp older than 5 minutes, even correctly signed', async () => {
    const res = await deviceEvents(signedDeviceRequest(deviceBody('FALL', nowSeconds() - 301)));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('stale timestamp');
  });

  it('rejects an unknown serial the same way as a bad signature', async () => {
    const res = await deviceEvents(signedDeviceRequest({ ...deviceBody('FALL'), serial: 'nope' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('invalid signature');
  });

  it('rejects an invalid body', async () => {
    expect((await deviceEvents(signedDeviceRequest({ serial: SERIAL, type: 'EXPLODE', ts: 1 }))).status).toBe(400);
    expect((await deviceEvents(jsonRequest('/api/device/events', { body: 'not json' }))).status).toBe(400);
  });

  it('a replayed message counts once: it cannot cancel a real incident', async () => {
    const { incidentId } = await fall();
    const ts = nowSeconds();
    await deviceEvents(signedDeviceRequest(deviceBody('STANDING', ts)));
    const replay = await deviceEvents(signedDeviceRequest(deviceBody('STANDING', ts)));
    expect((await replay.json()).duplicate).toBe(true);
    expect(await db().incidentEvent.count({ where: { incidentId, kind: 'STANDING' } })).toBe(1);
  });
});

function signedWebhook(body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  return jsonRequest('/api/line/webhook', {
    body: raw,
    headers: {
      'x-line-signature': createHmac('sha256', secret).update(raw).digest('base64'),
    },
  });
}

const postback = (
  userId: string,
  data: string,
  webhookEventId = `evt-${Math.random()}`,
) => ({
  destination: 'x',
  events: [
    {
      type: 'postback',
      webhookEventId,
      replyToken: 'reply-token',
      source: { type: 'user', userId: lineId(userId) },
      postback: { data },
      timestamp: Date.now(),
      mode: 'active',
      deliveryContext: { isRedelivery: false },
    },
  ],
});

describe('LINE webhook', () => {
  it('rejects a bad signature without doing anything', async () => {
    const { incidentId } = await fall();
    const res = await webhook(
      signedWebhook(postback(SOMCHAI, `action=accept&incident=${incidentId}`), 'wrong-secret'),
    );
    expect(res.status).toBe(401);
    await flushAfter();
    expect((await db().incident.findUniqueOrThrow({ where: { id: incidentId } })).status).toBe('ALERTING');
    expect(await db().processedWebhookEvent.count()).toBe(0);
  });

  it('rejects a missing signature', async () => {
    const res = await webhook(jsonRequest('/api/line/webhook', { body: { events: [] } }));
    expect(res.status).toBe(401);
  });

  it('accepts LINE\'s empty verification ping', async () => {
    const res = await webhook(signedWebhook({ destination: 'x', events: [] }));
    expect(res.status).toBe(200);
  });

  it('accept postback gives the job to the sender', async () => {
    const { incidentId } = await fall();
    await webhook(signedWebhook(postback(SOMCHAI, `action=accept&incident=${incidentId}`)));
    await flushAfter();
    const incident = await db().incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(incident.status).toBe('ACCEPTED');
    expect(incident.acceptedById).toBe(SOMCHAI);
  });

  it('processes a duplicate webhookEventId once', async () => {
    const { incidentId } = await fall();
    const body = postback(SOMCHAI, `action=accept&incident=${incidentId}`, 'same-event');
    await webhook(signedWebhook(body));
    await webhook(signedWebhook(body));
    await flushAfter();
    expect(await db().processedWebhookEvent.count({ where: { webhookEventId: 'same-event' } })).toBe(1);
    expect(await db().incidentEvent.count({ where: { incidentId, kind: 'ACCEPT' } })).toBe(1);

    const again = postback(DAENG, 'action=decline&incident=none', 'same-event');
    await webhook(signedWebhook(again));
    await flushAfter();
    expect(await db().processedWebhookEvent.count()).toBe(1);
  });

  it('the loser of a race gets a free reply, not a push', async () => {
    const fake = new FakeTransport();
    setTransportForTests(fake);
    const { incidentId } = await fall();
    await acceptIncident(incidentId, SOMCHAI);
    await webhook(signedWebhook(postback(DAENG, `action=accept&incident=${incidentId}`)));
    await flushAfter();
    const reply = fake.calls.find((call) => call.kind === 'reply');
    expect(JSON.stringify(reply?.messages)).toContain('คุณสมชาย รับงานแล้ว สแตนด์บายไว้ก่อน');
  });

  it('ignores a postback from someone outside the circle', async () => {
    const { incidentId } = await fall();
    await db().user.create({ data: { lineUserId: 'U-outsider', displayName: 'x' } });
    const body = postback('x', `action=accept&incident=${incidentId}`);
    body.events[0]!.source.userId = 'U-outsider';
    await webhook(signedWebhook(body));
    await flushAfter();
    expect((await db().incident.findUniqueOrThrow({ where: { id: incidentId } })).status).toBe('ALERTING');
  });

  it('key confirmation lets the accepter know', async () => {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, SOMCHAI);
    await webhook(signedWebhook(postback(DAENG, `action=key&incident=${incidentId}`)));
    await flushAfter();
    const message = (await outbound(incidentId)).find((m) => m.template === 'key.confirmed')!;
    expect(message.recipientUserIds).toEqual([SOMCHAI]);
    expect(JSON.stringify(message.messages)).toContain('ป้าแดงถือกุญแจ รอที่หน้าบ้าน');
  });

  it('creates a user on follow', async () => {
    await webhook(
      signedWebhook({
        destination: 'x',
        events: [
          {
            type: 'follow',
            webhookEventId: 'follow-1',
            replyToken: 't',
            source: { type: 'user', userId: 'U-newcomer' },
            follow: { isUnblocked: false },
            timestamp: Date.now(),
            mode: 'active',
            deliveryContext: { isRedelivery: false },
          },
        ],
      }),
    );
    await flushAfter();
    expect(await db().user.count({ where: { lineUserId: 'U-newcomer' } })).toBe(1);
  });
});

describe('LIFF auth', () => {
  it('rejects a missing token', async () => {
    const res = await authLine(jsonRequest('/api/auth/line', { body: {} }), params({}));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid token', async () => {
    const res = await authLine(jsonRequest('/api/auth/line', { body: { idToken: 'forged' } }), params({}));
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('exchanges a valid token for a session, identified by sub', async () => {
    const res = await authLine(
      jsonRequest('/api/auth/line', { body: { idToken: `line:${lineId(SOMCHAI)}` } }),
      params({}),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`);
    expect(res.headers.get('set-cookie')?.toLowerCase()).toContain('httponly');
  });

  it('ignores a userId supplied by the client', async () => {
    const res = await authLine(
      jsonRequest('/api/auth/line', {
        body: { idToken: `line:${lineId(NID)}`, userId: DAUGHTER, lineUserId: lineId(DAUGHTER), sub: lineId(DAUGHTER) },
      }),
      params({}),
    );
    const session = await db().session.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
    expect(res.status).toBe(200);
    expect(session.userId).toBe(NID);
  });

  it.each([
    ['GET elder', () => elderGet(jsonRequest(`/api/liff/elder/${SOMSRI}`, { method: 'GET' }), params({ id: SOMSRI }))],
    ['POST availability', () => availability(jsonRequest('/api/liff/availability', { body: { availability: false } }), params({}))],
    ['POST accept', () => accept(jsonRequest('/api/liff/incident/x/accept', { body: {} }), params({ id: 'x' }))],
  ])('%s without a token is 401', async (_name, call) => {
    expect((await call()).status).toBe(401);
  });

  it('rejects an invalid Bearer token', async () => {
    const res = await elderGet(
      jsonRequest(`/api/liff/elder/${SOMSRI}`, { method: 'GET', headers: { authorization: 'Bearer forged' } }),
      params({ id: SOMSRI }),
    );
    expect(res.status).toBe(401);
  });

  it('a userId in the body does not change who accepts', async () => {
    const { incidentId } = await fall();
    const res = await accept(
      jsonRequest(`/api/liff/incident/${incidentId}/accept`, {
        body: { userId: DAENG, lineUserId: lineId(DAENG) },
        headers: bearer(lineId(SOMCHAI)),
      }),
      params({ id: incidentId }),
    );
    expect(res.status).toBe(200);
    expect((await db().incident.findUniqueOrThrow({ where: { id: incidentId } })).acceptedById).toBe(SOMCHAI);
  });

  it('a userId in the body cannot change someone else\'s availability', async () => {
    await availability(
      jsonRequest('/api/liff/availability', {
        body: { availability: false, userId: DAENG },
        headers: bearer(lineId(SOMCHAI)),
      }),
      params({}),
    );
    expect((await db().user.findUniqueOrThrow({ where: { id: DAENG } })).availability).toBe(true);
    expect((await db().user.findUniqueOrThrow({ where: { id: SOMCHAI } })).availability).toBe(false);
  });
});

describe('privacy through the API', () => {
  const getElder = (sub: string) =>
    elderGet(
      jsonRequest(`/api/liff/elder/${SOMSRI}`, { method: 'GET', headers: bearer(lineId(sub)) }),
      params({ id: SOMSRI }),
    );
  const getIncident = (sub: string, id: string) =>
    incidentGet(
      jsonRequest(`/api/liff/incident/${id}`, { method: 'GET', headers: bearer(lineId(sub)) }),
      params({ id }),
    );

  it('BACKUP cannot see medications or key holder before accepting', async () => {
    const { incidentId } = await fall();

    const elder = await getElder(NID);
    expect(elder.status).toBe(200);
    const elderText = await elder.text();
    expect(elderText).not.toContain('ยาละลายลิ่มเลือด');
    expect(elderText).not.toContain('ความดันโลหิตสูง');
    expect(JSON.parse(elderText).private).toBeNull();
    expect(elderText).not.toContain('hasKey');

    const incident = await getIncident(NID, incidentId);
    const incidentText = await incident.text();
    expect(incidentText).not.toContain('ยาละลายลิ่มเลือด');
    expect(incidentText).not.toContain('0800000002');
    expect(incidentText).not.toContain('บ้านสีฟ้า');
    expect(JSON.parse(incidentText).private).toBeNull();
  });

  it('BACKUP sees it after accepting, and loses it when the incident closes', async () => {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, NID);

    expect(await (await getElder(NID)).text()).toContain('ยาละลายลิ่มเลือด');
    const view = await (await getIncident(NID, incidentId)).json();
    expect(view.private.keyHolder.name).toBe('ป้าแดง');

    await familyClose(incidentId, DAUGHTER);
    expect((await (await getElder(NID)).json()).private).toBeNull();
  });

  it('a BACKUP who did not accept still sees nothing', async () => {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, NID);
    expect((await (await getElder('demo-oi')).json()).private).toBeNull();
  });

  it.each([SOMCHAI, DAUGHTER])('%s (INNER / FAMILY) always sees it', async (user) => {
    expect((await (await getElder(user)).json()).private.medications).toHaveLength(3);
  });

  it('someone outside the circle gets 404', async () => {
    const res = await getElder('stranger');
    expect(res.status).toBe(404);
  });
});

describe('arrival through the API', () => {
  it('rejects 500 m with a Thai message', async () => {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, SOMCHAI);
    const res = await arrive(
      jsonRequest(`/api/liff/incident/${incidentId}/arrive`, {
        body: { lat: HOME.lat + 0.0045, lng: HOME.lng },
        headers: bearer(lineId(SOMCHAI)),
      }),
      params({ id: incidentId }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/คุณยังอยู่ห่างจากบ้าน 500 ม\./);
  });

  it('accepts 50 m', async () => {
    const { incidentId } = await fall();
    await acceptIncident(incidentId, SOMCHAI);
    const res = await arrive(
      jsonRequest(`/api/liff/incident/${incidentId}/arrive`, {
        body: { lat: HOME.lat + 0.00045, lng: HOME.lng },
        headers: bearer(lineId(SOMCHAI)),
      }),
      params({ id: incidentId }),
    );
    expect(res.status).toBe(200);
  });
});

describe('invites', () => {
  it('a token joins the circle once', async () => {
    const token = await createInvite(DAUGHTER, SOMSRI, 'INNER');
    const join = (sub: string) =>
      joinInvite(
        jsonRequest(`/api/liff/invite/${token}`, { headers: bearer(sub) }),
        params({ token }),
      );
    expect((await join('U-new-1')).status).toBe(200);
    expect((await join('U-new-2')).status).toBe(410);
    const member = await db().circleMember.findFirstOrThrow({ where: { user: { lineUserId: 'U-new-1' } } });
    expect(member.role).toBe('INNER');
  });

  it('only family can invite', async () => {
    await expect(createInvite(SOMCHAI, SOMSRI, 'INNER')).rejects.toThrow();
  });
});

describe('cron and demo guards', () => {
  it('cron needs the Bearer secret', async () => {
    expect((await cronGet(new Request('http://x/api/cron/tick'))).status).toBe(401);
    expect(
      (await cronGet(new Request('http://x/api/cron/tick', { headers: { authorization: 'Bearer nope' } }))).status,
    ).toBe(401);
    expect(
      (await cronGet(new Request('http://x/api/cron/tick', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))).status,
    ).toBe(200);
  });

  it('demo routes are 404 without the cookie', async () => {
    const res = await demoEvent(
      jsonRequest('/api/demo/event', { body: { elderId: SOMSRI, type: 'FALL' } }),
      params({}),
    );
    expect(res.status).toBe(404);
  });

  it('demo login rejects a wrong secret and issues a cookie for the right one', async () => {
    expect((await demoLogin(jsonRequest('/api/demo/login', { body: { secret: 'no' } }), params({}))).status).toBe(401);
    const res = await demoLogin(
      jsonRequest('/api/demo/login', { body: { secret: process.env.DEMO_SECRET } }),
      params({}),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain(`${DEMO_COOKIE}=`);
  });

  it('acting as someone is limited to seeded people', async () => {
    const real = await db().user.create({ data: { lineUserId: 'U-real', displayName: 'จริง' } });
    const cookie = `${DEMO_COOKIE}=${demoCookieValue()}`;
    const act = (userId: string) =>
      demoActAs(jsonRequest('/api/demo/act-as', { body: { userId }, headers: { cookie } }), params({}));
    expect((await act(real.id)).status).toBe(404);
    expect((await act(SOMCHAI)).status).toBe(200);
  });
});

describe('outbound delivery', () => {
  async function realUsers() {
    await db().user.update({ where: { id: SOMCHAI }, data: { isDemo: false } });
    await db().user.update({ where: { id: DAENG }, data: { isDemo: false } });
  }

  it('sends only to real IDs: one fake ID would sink a whole multicast', async () => {
    const fake = new FakeTransport();
    setTransportForTests(fake);
    await realUsers();
    const { outboundIds } = await fall();
    await deliverOutbound(outboundIds);

    const multicast = fake.calls.find((call) => call.kind === 'multicast')!;
    expect((multicast.to as string[]).sort()).toEqual([lineId(DAENG), lineId(SOMCHAI)].sort());
    const [alert] = await db().outboundMessage.findMany({ where: { id: { in: outboundIds }, template: 'alert' } });
    expect(alert!.status).toBe('SENT');
  });

  it('marks a demo-only audience as simulated without calling LINE', async () => {
    const fake = new FakeTransport();
    setTransportForTests(fake);
    const { outboundIds } = await fall();
    await deliverOutbound(outboundIds);
    expect(fake.calls).toEqual([]);
    const rows = await db().outboundMessage.findMany({ where: { id: { in: outboundIds } } });
    expect(rows.every((row) => row.status === 'SIMULATED')).toBe(true);
  });

  it('falls back to single pushes when LINE rejects a multicast', async () => {
    const fake = new FakeTransport();
    fake.multicastResult = { ok: false, status: 400, retriable: false };
    setTransportForTests(fake);
    await realUsers();
    const { outboundIds } = await fall();
    await deliverOutbound(outboundIds);
    expect(fake.calls.filter((call) => call.kind === 'push').map((call) => call.to).sort()).toEqual(
      [lineId(DAENG), lineId(SOMCHAI)].sort(),
    );
  });

  it('keeps a message for retry on a 429, and the flow carries on', async () => {
    const fake = new FakeTransport();
    fake.multicastResult = { ok: false, status: 429, retriable: true };
    setTransportForTests(fake);
    await realUsers();
    const { incidentId, outboundIds } = await fall();
    await deliverOutbound(outboundIds);

    const [alert] = await db().outboundMessage.findMany({ where: { incidentId, template: 'alert' } });
    expect(alert!.status).toBe('PENDING');
    expect(alert!.lastError).toBe('429');
    expect((await db().incident.findUniqueOrThrow({ where: { id: incidentId } })).status).toBe('ALERTING');

    fake.multicastResult = { ok: true };
    await retryPendingOutbound(new Date(Date.now() + 60_000));
    const [retried] = await db().outboundMessage.findMany({ where: { incidentId, template: 'alert' } });
    expect(retried!.status).toBe('SENT');
  });

  it('falls back to a push when the reply token fails', async () => {
    const fake = new FakeTransport();
    fake.replyResult = { ok: false, status: 400, retriable: false };
    setTransportForTests(fake);
    await realUsers();
    const { incidentId } = await fall();
    const result = await acceptIncident(incidentId, SOMCHAI, { replyToken: 'expired' });
    if (result.outcome !== 'won') throw new Error('expected to win');
    await deliverOutbound(result.outboundIds);
    expect(fake.calls.some((call) => call.kind === 'reply')).toBe(true);
    expect(fake.calls.some((call) => call.kind === 'push' && call.to === lineId(SOMCHAI))).toBe(true);
  });
});
