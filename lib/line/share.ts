import { card, type LineMessage } from './flex';
import { liffUrl } from './urls';

/**
 * The alert a person sends from their own account with the share target picker.
 * No Official Account is involved, so LINE allows link buttons only: there is
 * no bot to receive a postback. A fictional incident says so, so nobody panics.
 */
export function shareAlertMessage(incident: {
  id: string;
  elderName: string;
  demo: boolean;
}): LineMessage {
  return card(
    incident.demo
      ? 'ReachIn สาธิต: มีเหตุต้องการคนช่วย'
      : 'ReachIn: มีเหตุต้องการคนช่วย',
    {
    tone: 'urgent',
    eyebrow: incident.demo ? 'สาธิต ReachIn · ไม่ใช่เหตุจริง' : 'ต้องการคนช่วยด่วน',
    title: `${incident.elderName}ต้องการคนช่วย`,
    lines: [
      incident.demo
        ? 'กดเพื่อเปิดงาน แล้วลองรับงานแข่งกับคนอื่นในวง'
        : 'กดเพื่อดูรายละเอียดและรับงาน',
    ],
    buttons: [
      {
        label: 'เปิดดูและรับงาน',
        uri: liffUrl(`/liff/incident/${incident.id}/alert`),
        primary: true,
      },
    ],
    },
  );
}
