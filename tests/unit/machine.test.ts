import { describe, expect, it } from 'vitest';
import {
  transition,
  type IncidentState,
  type MachineEvent,
  type SideEffect,
  type Snapshot,
} from '@/lib/incident/machine';

const STATES: IncidentState[] = [
  'DETECTED',
  'ALERTING',
  'ACCEPTED',
  'ARRIVED',
  'RESOLVED',
  'CANCELLED_SELF',
  'CLOSED_BY_FAMILY',
];

const snap = (state: IncidentState, facts: Partial<Snapshot> = {}): Snapshot => ({
  state,
  escalated: false,
  voiceOk: false,
  standing: false,
  voiceHelp: false,
  ...facts,
});

const EVENTS: MachineEvent[] = [
  { type: 'START_ALERT', helperCount: 3 },
  { type: 'ACCEPT', userId: 'u1' },
  { type: 'DECLINE', userId: 'u1', allDeclined: false },
  { type: 'ARRIVE' },
  { type: 'ARRIVAL_TIMEOUT', previousAccepterId: 'u1', helperCount: 3 },
  { type: 'NO_ACCEPT_TIMEOUT' },
  { type: 'VOICE_OK' },
  { type: 'STANDING' },
  { type: 'VOICE_HELP' },
  { type: 'NO_RESPONSE' },
  { type: 'EMS_TRIGGERED' },
  { type: 'SUBMIT_SUMMARY' },
  { type: 'FAMILY_CLOSE' },
];

/** Every legal (state, event) pair. Anything not here must be refused. */
const LEGAL: Record<IncidentState, Array<MachineEvent['type']>> = {
  DETECTED: ['START_ALERT'],
  ALERTING: ['ACCEPT', 'DECLINE', 'NO_ACCEPT_TIMEOUT', 'VOICE_OK', 'STANDING', 'VOICE_HELP', 'NO_RESPONSE', 'FAMILY_CLOSE'],
  ACCEPTED: ['ARRIVE', 'ARRIVAL_TIMEOUT', 'VOICE_OK', 'STANDING', 'VOICE_HELP', 'NO_RESPONSE', 'EMS_TRIGGERED', 'FAMILY_CLOSE'],
  ARRIVED: ['VOICE_OK', 'STANDING', 'VOICE_HELP', 'NO_RESPONSE', 'EMS_TRIGGERED', 'SUBMIT_SUMMARY', 'FAMILY_CLOSE'],
  RESOLVED: [],
  CANCELLED_SELF: [],
  CLOSED_BY_FAMILY: [],
};

const kinds = (effects: SideEffect[]) => effects.map((effect) => effect.kind);

function must(result: ReturnType<typeof transition>) {
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('transition table', () => {
  for (const state of STATES) {
    for (const event of EVENTS) {
      const legal = LEGAL[state].includes(event.type);
      it(`${state} + ${event.type} is ${legal ? 'allowed' : 'refused'}`, () => {
        const result = transition(snap(state), event);
        expect(result.ok).toBe(legal);
      });
    }
  }
});

describe('alerting', () => {
  it('alerts helpers and family at the same moment, without waiting for a voice answer', () => {
    const result = must(transition(snap('DETECTED'), { type: 'START_ALERT', helperCount: 4 }));
    expect(result.nextState).toBe('ALERTING');
    expect(result.escalated).toBe(false);
    expect(result.sideEffects).toEqual([
      { kind: 'notifyHelpers', template: 'alert' },
      { kind: 'notifyFamily', template: 'searching' },
    ]);
  });

  it('escalates at once when nobody is available', () => {
    const result = must(transition(snap('DETECTED'), { type: 'START_ALERT', helperCount: 0 }));
    expect(result.nextState).toBe('ALERTING');
    expect(result.escalated).toBe(true);
    expect(result.sideEffects).toContainEqual({ kind: 'notifyEscalation', reason: 'NO_HELPERS' });
  });
});

describe('accept', () => {
  it('moves to ACCEPTED and tells everyone', () => {
    const result = must(transition(snap('ALERTING'), { type: 'ACCEPT', userId: 'u1' }));
    expect(result.nextState).toBe('ACCEPTED');
    expect(result.sideEffects).toEqual([
      { kind: 'replyAccepter' },
      { kind: 'notifyStandby', template: 'taken' },
      { kind: 'notifyFamily', template: 'going' },
      { kind: 'notifyKeyHolder' },
    ]);
  });

  it.each(['ACCEPTED', 'ARRIVED'] as const)('reports ALREADY_TAKEN in %s', (state) => {
    expect(transition(snap(state), { type: 'ACCEPT', userId: 'u2' })).toEqual({
      ok: false,
      error: 'ALREADY_TAKEN',
    });
  });

  it('allows accepting after escalation, keeping the flag', () => {
    const result = must(transition(snap('ALERTING', { escalated: true }), { type: 'ACCEPT', userId: 'u1' }));
    expect(result.nextState).toBe('ACCEPTED');
    expect(result.escalated).toBe(true);
  });
});

describe('decline', () => {
  it('changes nothing while others may still go', () => {
    const result = must(transition(snap('ALERTING'), { type: 'DECLINE', userId: 'u1', allDeclined: false }));
    expect(result.nextState).toBe('ALERTING');
    expect(result.sideEffects).toEqual([]);
  });

  it('escalates early when everyone has declined', () => {
    const result = must(transition(snap('ALERTING'), { type: 'DECLINE', userId: 'u1', allDeclined: true }));
    expect(result.escalated).toBe(true);
    expect(result.sideEffects).toEqual([{ kind: 'notifyEscalation', reason: 'ALL_DECLINED' }]);
  });
});

describe('arrive', () => {
  it('moves to ARRIVED and thanks the standby helpers', () => {
    const result = must(transition(snap('ACCEPTED'), { type: 'ARRIVE' }));
    expect(result.nextState).toBe('ARRIVED');
    expect(result.sideEffects).toEqual([
      { kind: 'notifyStandby', template: 'arrived' },
      { kind: 'notifyFamily', template: 'arrived' },
    ]);
  });
});

describe('arrival timeout', () => {
  it('reopens the job for everyone except the previous accepter', () => {
    const result = must(
      transition(snap('ACCEPTED'), { type: 'ARRIVAL_TIMEOUT', previousAccepterId: 'u1', helperCount: 2 }),
    );
    expect(result.nextState).toBe('ALERTING');
    expect(result.sideEffects).toContainEqual({ kind: 'notifyHelpers', template: 'alert', exceptUserId: 'u1' });
  });

  it('escalates if nobody else is left', () => {
    const result = must(
      transition(snap('ACCEPTED'), { type: 'ARRIVAL_TIMEOUT', previousAccepterId: 'u1', helperCount: 0 }),
    );
    expect(result.escalated).toBe(true);
    expect(kinds(result.sideEffects)).toContain('notifyEscalation');
  });
});

describe('no-accept timeout', () => {
  it('escalates once, without changing state or calling anyone', () => {
    const result = must(transition(snap('ALERTING'), { type: 'NO_ACCEPT_TIMEOUT' }));
    expect(result.nextState).toBe('ALERTING');
    expect(result.escalated).toBe(true);
    expect(result.sideEffects).toEqual([{ kind: 'notifyEscalation', reason: 'NO_ACCEPT' }]);
  });

  it('does not re-push on a second timeout', () => {
    expect(transition(snap('ALERTING', { escalated: true }), { type: 'NO_ACCEPT_TIMEOUT' })).toEqual({
      ok: false,
      error: 'ALREADY_ESCALATED',
    });
  });
});

describe('voice and radar', () => {
  it('VOICE_OK while still on the floor does not cancel', () => {
    const result = must(transition(snap('ALERTING'), { type: 'VOICE_OK' }));
    expect(result.nextState).toBe('ALERTING');
    expect(result.sideEffects).toEqual([]);
  });

  it('STANDING alone does not cancel', () => {
    expect(must(transition(snap('ALERTING'), { type: 'STANDING' })).nextState).toBe('ALERTING');
  });

  it.each([
    ['VOICE_OK then STANDING', { voiceOk: true }, 'STANDING'],
    ['STANDING then VOICE_OK', { standing: true }, 'VOICE_OK'],
  ] as const)('%s cancels and notifies helpers and family', (_name, facts, type) => {
    const result = must(transition(snap('ALERTING', facts), { type }));
    expect(result.nextState).toBe('CANCELLED_SELF');
    expect(result.sideEffects).toEqual([
      { kind: 'notifyHelpers', template: 'cancelled' },
      { kind: 'notifyFamily', template: 'cancelled' },
    ]);
  });

  it('a cry for help overrides "ไม่เป็นไร"', () => {
    const result = must(transition(snap('ALERTING', { voiceOk: true, voiceHelp: true }), { type: 'STANDING' }));
    expect(result.nextState).toBe('ALERTING');
  });

  it.each(['ACCEPTED', 'ARRIVED'] as const)('never cancels in %s: the helper keeps going', (state) => {
    const result = must(transition(snap(state, { voiceOk: true }), { type: 'STANDING' }));
    expect(result.nextState).toBe(state);
  });

  it.each(['ALERTING', 'ACCEPTED', 'ARRIVED'] as const)('NO_RESPONSE escalates from %s without changing state', (state) => {
    const result = must(transition(snap(state), { type: 'NO_RESPONSE' }));
    expect(result.nextState).toBe(state);
    expect(result.escalated).toBe(true);
    expect(result.sideEffects).toEqual([{ kind: 'notifyEscalation', reason: 'NO_RESPONSE' }]);
  });

  it.each(['ALERTING', 'ACCEPTED', 'ARRIVED'] as const)('VOICE_HELP escalates from %s', (state) => {
    expect(must(transition(snap(state), { type: 'VOICE_HELP' })).escalated).toBe(true);
  });

  it('a second escalation signal stays quiet', () => {
    const result = must(transition(snap('ALERTING', { escalated: true }), { type: 'NO_RESPONSE' }));
    expect(result.sideEffects).toEqual([]);
  });
});

describe('finishing', () => {
  it('summary resolves and goes to the family', () => {
    const result = must(transition(snap('ARRIVED'), { type: 'SUBMIT_SUMMARY' }));
    expect(result.nextState).toBe('RESOLVED');
    expect(result.sideEffects).toEqual([{ kind: 'notifyFamily', template: 'summary' }]);
  });

  it('EMS tells the family once', () => {
    const first = must(transition(snap('ARRIVED'), { type: 'EMS_TRIGGERED' }));
    expect(first.escalated).toBe(true);
    expect(first.sideEffects).toEqual([{ kind: 'notifyFamily', template: 'ems' }]);
    const second = must(transition(snap('ARRIVED', { escalated: true }), { type: 'EMS_TRIGGERED' }));
    expect(second.sideEffects).toEqual([]);
  });

  it.each(['ALERTING', 'ACCEPTED', 'ARRIVED'] as const)('family can close from %s', (state) => {
    const result = must(transition(snap(state), { type: 'FAMILY_CLOSE' }));
    expect(result.nextState).toBe('CLOSED_BY_FAMILY');
    expect(result.sideEffects).toEqual([{ kind: 'notifyHelpers', template: 'closed' }]);
  });
});
