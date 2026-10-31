import { describe, expect, it } from 'vitest';
import { planMessages, type DispatchContext } from '@/lib/incident/dispatcher';
import { describeCard } from '@/lib/line/flex';

const base: DispatchContext = {
  incidentId: 'inc1',
  nextState: 'ALERTING',
  type: 'FALL',
  escalated: false,
  room: 'ห้องน้ำ',
  detectedAt: new Date('2026-10-31T20:12:00Z'),
  arrivedAt: null,
  elder: { name: 'คุณยายสมศรี', title: 'คุณยาย', familyTerm: 'แม่', phone: '0800000011' },
  accepter: { id: 'somchai', displayName: 'คุณสมชาย' },
  helpers: { available: ['somchai', 'daeng', 'nid'], all: ['somchai', 'daeng', 'nid', 'oi'], alerted: ['somchai', 'daeng', 'nid'] },
  familyIds: ['daughter'],
  keyHolderIds: ['daeng'],
};

const text = (drafts: ReturnType<typeof planMessages>) =>
  drafts.map((draft) => draft.messages.map(describeCard).join(' '));

describe('planMessages', () => {
  it('sends the exact family alert wording', () => {
    const [draft] = planMessages([{ kind: 'notifyFamily', template: 'searching' }], base);
    expect(draft!.recipientUserIds).toEqual(['daughter']);
    expect(text([draft!])[0]).toContain('แม่ล้มในห้องน้ำ กำลังหาคนไปช่วย');
  });

  it('puts the elder name in the card but never in alt text', () => {
    const [draft] = planMessages([{ kind: 'notifyHelpers', template: 'alert' }], { ...base, accepter: null });
    const message = draft!.messages[0]!;
    expect(describeCard(message)).toContain('คุณยายสมศรีล้มในห้องน้ำ');
    expect(JSON.stringify((message as { altText: string }).altText)).not.toContain('สมศรี');
  });

  it('never places a name or condition in any alt text or postback data', () => {
    const effects = [
      { kind: 'notifyHelpers', template: 'alert' },
      { kind: 'notifyHelpers', template: 'cancelled' },
      { kind: 'notifyStandby', template: 'taken' },
      { kind: 'notifyStandby', template: 'arrived' },
      { kind: 'notifyKeyHolder' },
      { kind: 'replyAccepter' },
      { kind: 'notifyEscalation', reason: 'NO_ACCEPT' },
      ...(['searching', 'going', 'arrived', 'cancelled', 'reopened', 'ems', 'summary'] as const).map(
        (template) => ({ kind: 'notifyFamily', template }),
      ),
    ] as Parameters<typeof planMessages>[0];
    const drafts = planMessages(effects, {
      ...base,
      summary: { resultLabel: 'ลุกได้', note: 'ยาละลายลิ่มเลือด' },
    });
    expect(drafts.length).toBeGreaterThan(10);

    for (const draft of drafts) {
      for (const message of draft.messages) {
        const alt = (message as { altText?: string }).altText ?? '';
        expect(alt).toMatch(/^ReachIn: /);
        for (const secret of ['สมศรี', 'คุณสมชาย', 'ป้าแดง', 'ยา', 'ซอย']) {
          expect(alt).not.toContain(secret);
        }
        const postbacks = JSON.stringify(message).match(/"data":"[^"]*"/g) ?? [];
        for (const data of postbacks) {
          expect(data).toMatch(/^"data":"action=(accept|decline|key)&incident=inc1"$/);
        }
      }
    }
  });

  it('keeps every postback under 300 characters', () => {
    const drafts = planMessages([{ kind: 'notifyHelpers', template: 'alert' }], {
      ...base,
      incidentId: 'c'.repeat(30),
    });
    const data = JSON.stringify(drafts).match(/"data":"([^"]*)"/g) ?? [];
    expect(data.length).toBeGreaterThan(0);
    for (const item of data) expect(item.length).toBeLessThan(300);
  });

  it('skips the previous accepter on re-alert', () => {
    const [draft] = planMessages(
      [{ kind: 'notifyHelpers', template: 'alert', exceptUserId: 'somchai' }],
      base,
    );
    expect(draft!.template).toBe('realert');
    expect(draft!.recipientUserIds).toEqual(['daeng', 'nid']);
  });

  it('asks the key holder and spares them the standby push', () => {
    const drafts = planMessages(
      [{ kind: 'notifyStandby', template: 'taken' }, { kind: 'notifyKeyHolder' }],
      base,
    );
    expect(drafts[0]!.recipientUserIds).toEqual(['nid']);
    expect(drafts[1]!.recipientUserIds).toEqual(['daeng']);
    expect(text(drafts)[1]).toContain('ช่วยถือกุญแจไปเจอ คุณสมชาย ที่หน้าบ้านได้ไหม');
  });

  it('does not ask the accepter to bring their own key', () => {
    const drafts = planMessages([{ kind: 'notifyKeyHolder' }], {
      ...base,
      accepter: { id: 'daeng', displayName: 'ป้าแดง' },
    });
    expect(drafts).toEqual([]);
  });

  it('gives escalations a tel:1669 button and reaches the whole circle', () => {
    const drafts = planMessages([{ kind: 'notifyEscalation', reason: 'NO_ACCEPT' }], {
      ...base,
      accepter: null,
      escalated: true,
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0]!.recipientUserIds).toEqual(['somchai', 'daeng', 'nid', 'oi']);
    expect(drafts[1]!.recipientUserIds).toEqual(['daughter']);
    for (const draft of drafts) expect(JSON.stringify(draft)).toContain('"uri":"tel:1669"');
    expect(JSON.stringify(drafts[0])).toContain('action=accept');
    expect(JSON.stringify(drafts[1])).not.toContain('action=accept');
  });

  it('uses the right family word for a grandfather', () => {
    const [draft] = planMessages([{ kind: 'notifyFamily', template: 'arrived' }], {
      ...base,
      elder: { name: 'คุณตาประยูร', title: 'คุณตา', familyTerm: 'พ่อ', phone: null },
    });
    expect(text([draft!])[0]).toContain('คุณสมชาย ถึงตัวพ่อแล้ว');
  });

  it('drops messages with no recipients', () => {
    expect(planMessages([{ kind: 'notifyFamily', template: 'searching' }], { ...base, familyIds: [] })).toEqual([]);
  });
});
