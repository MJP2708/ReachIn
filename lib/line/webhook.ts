import { messagingApi, type webhook } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db/errors';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/http-error';
import { deliverOutbound } from '@/lib/incident/outbox';
import {
  acceptIncident,
  confirmKey,
  declineIncident,
} from '@/lib/incident/service';
import { card } from './flex';
import { getTransport } from './transport';

const WELCOME =
  'สวัสดีจาก ReachIn เมื่อคนในวงของคุณต้องการความช่วยเหลือ ข้อความจะมาที่นี่';
const HELP =
  'ReachIn ส่งแจ้งเตือนเมื่อคนในวงของคุณต้องการความช่วยเหลือ กดปุ่มในข้อความแจ้งเตือนเพื่อรับงาน';

const UPDATE_ALT = 'ReachIn: อัปเดตสถานะงาน';

async function replyText(replyToken: string | undefined, text: string) {
  if (!replyToken) return;
  await getTransport().reply(
    replyToken,
    [{ type: 'text', text }],
    { template: 'reply.text', incidentId: null },
  );
}

/** The first delivery wins; LINE may redeliver the same event. */
async function claimEvent(webhookEventId: string): Promise<boolean> {
  try {
    await db().processedWebhookEvent.create({ data: { webhookEventId } });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

async function ensureUser(lineUserId: string) {
  const existing = await db().user.findUnique({ where: { lineUserId } });
  if (existing) return existing;

  let displayName = 'ผู้ใช้ LINE';
  let pictureUrl: string | undefined;
  if (getTransport().live) {
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: env().LINE_CHANNEL_ACCESS_TOKEN,
    });
    const profile = await client.getProfile(lineUserId).catch(() => null);
    if (profile) {
      displayName = profile.displayName;
      pictureUrl = profile.pictureUrl;
    }
  }
  return db().user.upsert({
    where: { lineUserId },
    create: { lineUserId, displayName, pictureUrl },
    update: {},
  });
}

export async function handlePostback(
  lineUserId: string,
  data: string,
  replyToken: string | undefined,
) {
  const params = new URLSearchParams(data);
  const incidentId = params.get('incident');
  if (!incidentId) return;

  const user = await db().user.findUnique({ where: { lineUserId } });
  if (!user) {
    await replyText(replyToken, 'คุณยังไม่ได้อยู่ในวงคนช่วยของ ReachIn');
    return;
  }

  try {
    switch (params.get('action')) {
      case 'accept': {
        const result = await acceptIncident(incidentId, user.id, { replyToken });
        if (result.outcome === 'won') {
          await deliverOutbound(result.outboundIds);
        } else if (replyToken) {
          await getTransport().reply(
            replyToken,
            [
              card(UPDATE_ALT, {
                tone: 'info',
                eyebrow: 'มีคนรับงานแล้ว',
                title: result.accepterName
                  ? `${result.accepterName} รับงานแล้ว สแตนด์บายไว้ก่อน`
                  : 'งานนี้ปิดไปแล้ว ขอบคุณที่พร้อมช่วย',
              }),
            ],
            { template: 'accept.lost', incidentId },
          );
        }
        break;
      }
      case 'decline': {
        const result = await declineIncident(incidentId, user.id);
        if (result.ok) await deliverOutbound(result.outboundIds);
        await replyText(replyToken, 'รับทราบ ขอบคุณที่แจ้ง');
        break;
      }
      case 'key': {
        const incident = await confirmKey(incidentId, user.id);
        if (incident.acceptedById) {
          const { id } = await db().outboundMessage.create({
            data: {
              incidentId,
              template: 'key.confirmed',
              audience: 'คนรับงาน',
              recipientUserIds: [incident.acceptedById],
              isDemo: incident.elder.isDemo,
              messages: [
                card(UPDATE_ALT, {
                  tone: 'ok',
                  eyebrow: 'เรื่องกุญแจ',
                  title: `${user.displayName}ถือกุญแจ รอที่หน้าบ้าน`,
                }),
              ] as object[],
            },
            select: { id: true },
          });
          await deliverOutbound([id]);
        }
        await replyText(replyToken, 'ขอบคุณที่ช่วยถือกุญแจไป');
        break;
      }
    }
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    await replyText(replyToken, 'คุณไม่ได้อยู่ในวงคนช่วยของงานนี้');
  }
}

export async function handleWebhookEvent(event: webhook.Event) {
  if (!(await claimEvent(event.webhookEventId))) return;

  const lineUserId =
    event.source?.type === 'user' ? event.source.userId : undefined;
  if (!lineUserId) return;

  switch (event.type) {
    case 'follow':
      await ensureUser(lineUserId);
      await replyText(event.replyToken, WELCOME);
      break;
    case 'postback':
      await handlePostback(lineUserId, event.postback.data, event.replyToken);
      break;
    case 'message':
      await replyText(event.replyToken, HELP);
      break;
  }
}
