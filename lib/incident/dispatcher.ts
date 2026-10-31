import { clock } from '@/lib/time';
import {
  acceptButton,
  card,
  declineButton,
  emsButton,
  keyButton,
  type CardButton,
  type LineMessage,
} from '@/lib/line/flex';
import { liffUrl } from '@/lib/line/urls';
import type {
  EscalationReason,
  FamilyTemplate,
  IncidentState,
  SideEffect,
} from './machine';

/** Everything the templates need, resolved by the service inside its transaction. */
export type DispatchContext = {
  incidentId: string;
  nextState: IncidentState;
  type: 'FALL' | 'LONG_STAY' | 'VOICE_HELP';
  escalated: boolean;
  room: string;
  detectedAt: Date;
  arrivedAt: Date | null;
  elder: {
    name: string;
    title: string;
    familyTerm: string;
    phone: string | null;
  };
  accepter: { id: string; displayName: string } | null;
  helpers: {
    /** Available right now; these get the first alert. */
    available: string[];
    /** Active in the circle, whatever their availability. */
    all: string[];
    /** Everyone alerted so far on this incident. */
    alerted: string[];
  };
  familyIds: string[];
  keyHolderIds: string[];
  summary?: { resultLabel: string; note: string };
};

export type OutboundDraft = {
  template: string;
  audience: string;
  recipientUserIds: string[];
  messages: LineMessage[];
  useReplyToken?: boolean;
};

// Lock screens show alt text, so these never carry a name or a condition.
const ALT = {
  alert: 'ReachIn: มีเหตุต้องการคนช่วย',
  update: 'ReachIn: อัปเดตสถานะงาน',
  emergency: 'ReachIn: แจ้งเตือนฉุกเฉิน',
  summary: 'ReachIn: สรุปการช่วยเหลือ',
  key: 'ReachIn: ขอความช่วยเหลือเรื่องกุญแจ',
} as const;

const incidentPath = (id: string, page: string) =>
  `/liff/incident/${id}/${page}`;

function headline(context: DispatchContext): string {
  const { elder, room, type } = context;
  if (type === 'LONG_STAY') return `${elder.name}อยู่ใน${room}นานผิดปกติ`;
  if (type === 'VOICE_HELP') return `${elder.name}ขอความช่วยเหลือจาก${room}`;
  return `${elder.name}ล้มใน${room}`;
}

function eyebrow(context: DispatchContext): string {
  return context.type === 'FALL'
    ? 'ตรวจพบการล้ม · ต้องการคนช่วย'
    : 'ต้องการคนช่วย';
}

function detailsButton(id: string): CardButton {
  return { label: 'ดูรายละเอียด', uri: liffUrl(incidentPath(id, 'alert')) };
}

function callElderButton(context: DispatchContext): CardButton[] {
  const { phone, familyTerm } = context.elder;
  return phone ? [{ label: `โทรหา${familyTerm}`, uri: `tel:${phone}` }] : [];
}

function alertCard(context: DispatchContext): LineMessage {
  const { incidentId, detectedAt, escalated } = context;
  return card(ALT.alert, {
    tone: 'urgent',
    eyebrow: eyebrow(context),
    title: headline(context),
    lines: [`${clock(detectedAt)} น.`],
    buttons: [
      acceptButton(incidentId),
      ...(escalated ? [emsButton] : []),
      declineButton(incidentId),
      detailsButton(incidentId),
    ],
  });
}

function familyMessage(
  template: FamilyTemplate,
  context: DispatchContext,
): LineMessage {
  const { elder, room, detectedAt, incidentId, arrivedAt, summary } = context;
  const term = elder.familyTerm;
  const name = context.accepter?.displayName ?? '';
  const status = detailsButton(incidentId);

  switch (template) {
    case 'searching':
      return card(ALT.update, {
        tone: 'urgent',
        eyebrow: `${clock(detectedAt)} น.`,
        title:
          context.type === 'FALL'
            ? `${term}ล้มใน${room} กำลังหาคนไปช่วย`
            : `${term}ต้องการคนช่วย กำลังหาคนไปช่วย`,
        buttons: [status],
      });
    case 'going':
      return card(ALT.update, {
        tone: 'info',
        eyebrow: 'มีคนรับงานแล้ว',
        title: `${name} กำลังไป`,
        buttons: [status],
      });
    case 'arrived':
      return card(ALT.update, {
        tone: 'ok',
        eyebrow: 'ถึงแล้ว',
        title: `${name} ถึงตัว${term}แล้ว`,
        buttons: [status],
      });
    case 'cancelled':
      return card(ALT.update, {
        tone: 'info',
        eyebrow: 'ยกเลิกงานแล้ว',
        title: `${term}ล้มแต่ลุกได้เอง ไม่บาดเจ็บ ลองโทรหา${term}หน่อยนะ`,
        buttons: callElderButton(context),
      });
    case 'reopened':
      return card(ALT.update, {
        tone: 'urgent',
        eyebrow: 'คนที่รับงานยังไปไม่ถึง',
        title: `กำลังหาคนใหม่ไปหา${term}`,
        buttons: [status],
      });
    case 'ems':
      return card(ALT.emergency, {
        tone: 'urgent',
        eyebrow: 'กำลังเรียกรถพยาบาล',
        title: `${name} กำลังโทร 1669 ให้${term}`,
        buttons: [status],
      });
    case 'summary':
      return card(ALT.summary, {
        tone: 'ok',
        eyebrow: 'สรุปการช่วยเหลือ',
        title: summary?.resultLabel ?? 'ช่วยเหลือเสร็จแล้ว',
        rows: [
          { label: 'ล้ม', value: `${clock(detectedAt)} น.` },
          ...(arrivedAt
            ? [{ label: 'ถึงตัว', value: `${clock(arrivedAt)} น.` }]
            : []),
          { label: 'คนช่วย', value: name },
        ],
        lines: summary?.note ? [summary.note] : [],
        buttons: callElderButton(context),
      });
  }
}

function escalationTitle(
  reason: EscalationReason,
  context: DispatchContext,
): string {
  const { title } = context.elder;
  switch (reason) {
    case 'NO_HELPERS':
      return 'ไม่มีคนช่วยที่พร้อมตอนนี้';
    case 'NO_ACCEPT':
      return 'ยังไม่มีคนรับงาน';
    case 'ALL_DECLINED':
      return 'ตอนนี้ไม่มีใครไปได้';
    case 'NO_RESPONSE':
      return `${title}ไม่ตอบและไม่ขยับ`;
    case 'VOICE_HELP':
      return `${title}ขอความช่วยเหลือ`;
  }
}

function escalationDrafts(
  reason: EscalationReason,
  context: DispatchContext,
): OutboundDraft[] {
  const title = escalationTitle(reason, context);
  const line = `${context.elder.name} · โทร 1669 ได้เลย ระบบไม่โทรให้อัตโนมัติ`;
  const stillOpen = context.nextState === 'ALERTING';
  const helperRecipients = context.helpers.all.filter(
    (id) => id !== context.accepter?.id || !stillOpen,
  );
  return [
    {
      template: `escalation.${reason}`,
      audience: 'คนช่วยทุกคน',
      recipientUserIds: helperRecipients,
      messages: [
        card(ALT.emergency, {
          tone: 'urgent',
          eyebrow: 'ฉุกเฉิน',
          title,
          lines: [line],
          buttons: [
            emsButton,
            ...(stillOpen ? [acceptButton(context.incidentId)] : []),
            detailsButton(context.incidentId),
          ],
        }),
      ],
    },
    {
      template: `escalation.${reason}.family`,
      audience: 'ลูกหลาน',
      recipientUserIds: context.familyIds,
      messages: [
        card(ALT.emergency, {
          tone: 'urgent',
          eyebrow: 'ฉุกเฉิน',
          title,
          lines: [line],
          buttons: [emsButton, detailsButton(context.incidentId)],
        }),
      ],
    },
  ];
}

const keyHolderToAsk = (context: DispatchContext) =>
  context.keyHolderIds.find((id) => id !== context.accepter?.id);

/**
 * Turn side-effect descriptions into concrete messages. Pure, so the content
 * and the audience of every message can be tested with no network.
 */
export function planMessages(
  effects: SideEffect[],
  context: DispatchContext,
): OutboundDraft[] {
  const drafts: OutboundDraft[] = [];
  const name = context.accepter?.displayName ?? '';
  const asksKey = effects.some((effect) => effect.kind === 'notifyKeyHolder');
  const keyHolderId = asksKey ? keyHolderToAsk(context) : undefined;

  for (const effect of effects) {
    switch (effect.kind) {
      case 'notifyHelpers': {
        if (effect.template === 'alert') {
          const reAlert = effect.exceptUserId !== undefined;
          drafts.push({
            template: reAlert ? 'realert' : 'alert',
            audience: 'คนช่วย',
            recipientUserIds: context.helpers.available.filter(
              (id) => id !== effect.exceptUserId,
            ),
            messages: [alertCard(context)],
          });
          break;
        }
        drafts.push({
          template: effect.template,
          audience: 'คนช่วย',
          recipientUserIds: context.helpers.alerted,
          messages: [
            card(ALT.update, {
              tone: 'info',
              eyebrow: 'ยกเลิกงานแล้ว',
              title:
                effect.template === 'cancelled'
                  ? `ยกเลิก ${context.elder.title}ลุกได้เองแล้ว`
                  : 'ครอบครัวปิดเหตุการณ์นี้แล้ว ขอบคุณที่สแตนด์บาย',
            }),
          ],
        });
        break;
      }

      case 'notifyStandby': {
        const taken = effect.template === 'taken';
        drafts.push({
          template: `standby.${effect.template}`,
          audience: 'คนสแตนด์บาย',
          // The key holder gets their own message, which already names the
          // accepter; a second push would only burn quota.
          recipientUserIds: context.helpers.alerted.filter(
            (id) =>
              id !== context.accepter?.id && !(taken && id === keyHolderId),
          ),
          messages: [
            card(ALT.update, {
              tone: 'info',
              eyebrow: taken ? 'มีคนรับงานแล้ว' : 'มีคนถึงแล้ว',
              title: taken
                ? `${name} รับงานแล้ว สแตนด์บายไว้ก่อน`
                : 'ถึงแล้ว ขอบคุณที่สแตนด์บาย',
            }),
          ],
        });
        break;
      }

      case 'notifyFamily':
        drafts.push({
          template: `family.${effect.template}`,
          audience: 'ลูกหลาน',
          recipientUserIds: context.familyIds,
          messages: [familyMessage(effect.template, context)],
        });
        break;

      case 'notifyKeyHolder':
        if (keyHolderId) {
          drafts.push({
            template: 'key',
            audience: 'คนถือกุญแจ',
            recipientUserIds: [keyHolderId],
            messages: [
              card(ALT.key, {
                tone: 'info',
                eyebrow: 'คุณมีกุญแจสำรอง',
                title: `ช่วยถือกุญแจไปเจอ ${name} ที่หน้าบ้านได้ไหม`,
                buttons: [keyButton(context.incidentId)],
              }),
            ],
          });
        }
        break;

      case 'replyAccepter':
        if (context.accepter) {
          drafts.push({
            template: 'accepted',
            audience: 'คนรับงาน',
            recipientUserIds: [context.accepter.id],
            useReplyToken: true,
            messages: [
              card(ALT.update, {
                tone: 'ok',
                eyebrow: 'คุณรับงานแล้ว',
                title: `ไปหา${context.elder.name}ได้เลย`,
                buttons: [
                  {
                    label: 'เปิดคู่มือช่วยเหลือ',
                    uri: liffUrl(incidentPath(context.incidentId, 'guide')),
                    primary: true,
                  },
                ],
              }),
            ],
          });
        }
        break;

      case 'notifyEscalation':
        drafts.push(...escalationDrafts(effect.reason, context));
        break;
    }
  }

  return drafts.filter((draft) => draft.recipientUserIds.length > 0);
}
