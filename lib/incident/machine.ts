/**
 * The incident state machine. Pure: no database, no network, no clock.
 *
 * Every status change in the system goes through `transition`. Callers supply
 * a snapshot of the facts it needs, and receive the next state and a list of
 * side effects described as data. lib/incident/service.ts persists the result
 * and lib/incident/dispatcher.ts turns the descriptions into messages.
 */

export const OPEN_STATES = [
  'DETECTED',
  'ALERTING',
  'ACCEPTED',
  'ARRIVED',
] as const;

export type OpenState = (typeof OPEN_STATES)[number];
export type IncidentState =
  | OpenState
  | 'RESOLVED'
  | 'CANCELLED_SELF'
  | 'CLOSED_BY_FAMILY';

export type Snapshot = {
  state: IncidentState;
  escalated: boolean;
  voiceOk: boolean;
  standing: boolean;
  voiceHelp: boolean;
};

export type MachineEvent =
  /** `helperCount`: how many people this alert can reach. */
  | { type: 'START_ALERT'; helperCount: number }
  | { type: 'ACCEPT'; userId: string }
  | { type: 'DECLINE'; userId: string; allDeclined: boolean }
  | { type: 'ARRIVE' }
  | { type: 'ARRIVAL_TIMEOUT'; previousAccepterId: string; helperCount: number }
  | { type: 'NO_ACCEPT_TIMEOUT' }
  | { type: 'VOICE_OK' }
  | { type: 'STANDING' }
  | { type: 'VOICE_HELP' }
  | { type: 'NO_RESPONSE' }
  | { type: 'EMS_TRIGGERED' }
  | { type: 'SUBMIT_SUMMARY' }
  | { type: 'FAMILY_CLOSE' };

export type EscalationReason =
  | 'NO_HELPERS'
  | 'NO_ACCEPT'
  | 'ALL_DECLINED'
  | 'NO_RESPONSE'
  | 'VOICE_HELP';

export type SideEffect =
  | { kind: 'notifyHelpers'; template: 'alert'; exceptUserId?: string }
  | { kind: 'notifyHelpers'; template: 'cancelled' | 'closed' }
  | { kind: 'notifyFamily'; template: FamilyTemplate }
  | { kind: 'notifyStandby'; template: 'taken' | 'arrived' }
  | { kind: 'notifyKeyHolder' }
  | { kind: 'replyAccepter' }
  /** Everyone in the circle, whatever their availability, with a 1669 button. */
  | { kind: 'notifyEscalation'; reason: EscalationReason };

export type FamilyTemplate =
  | 'searching'
  | 'going'
  | 'arrived'
  | 'cancelled'
  | 'reopened'
  | 'ems'
  | 'summary';

export type TransitionError =
  | 'ILLEGAL_TRANSITION'
  | 'ALREADY_TAKEN'
  | 'ALREADY_ESCALATED';

export type Transition = {
  ok: true;
  nextState: IncidentState;
  escalated: boolean;
  sideEffects: SideEffect[];
};

export type TransitionResult = Transition | { ok: false; error: TransitionError };

const ESCALATABLE: readonly IncidentState[] = [
  'ALERTING',
  'ACCEPTED',
  'ARRIVED',
];

export const isOpen = (state: IncidentState): state is OpenState =>
  (OPEN_STATES as readonly string[]).includes(state);

const illegal: TransitionResult = { ok: false, error: 'ILLEGAL_TRANSITION' };

function stay(
  snapshot: Snapshot,
  sideEffects: SideEffect[] = [],
  escalated = snapshot.escalated,
): TransitionResult {
  return { ok: true, nextState: snapshot.state, escalated, sideEffects };
}

function move(
  snapshot: Snapshot,
  nextState: IncidentState,
  sideEffects: SideEffect[],
): TransitionResult {
  return { ok: true, nextState, escalated: snapshot.escalated, sideEffects };
}

/** Escalation is one-shot: a repeat would re-push the whole circle. */
function escalate(
  snapshot: Snapshot,
  reason: EscalationReason,
): TransitionResult {
  if (!ESCALATABLE.includes(snapshot.state)) return illegal;
  if (snapshot.escalated) return stay(snapshot);
  return stay(snapshot, [{ kind: 'notifyEscalation', reason }], true);
}

/**
 * Cancelling needs both signals: the words alone do not count, because the
 * radar is trusted over speech ("ไม่เป็นไร" from the floor is not fine).
 * A helper already on the way keeps going.
 */
function afterVoiceOrStanding(snapshot: Snapshot): TransitionResult {
  if (!isOpen(snapshot.state) || snapshot.state === 'DETECTED') return illegal;
  if (
    snapshot.state === 'ALERTING' &&
    snapshot.voiceOk &&
    snapshot.standing &&
    !snapshot.voiceHelp
  ) {
    return move(snapshot, 'CANCELLED_SELF', [
      { kind: 'notifyHelpers', template: 'cancelled' },
      { kind: 'notifyFamily', template: 'cancelled' },
    ]);
  }
  return stay(snapshot);
}

export function transition(
  snapshot: Snapshot,
  event: MachineEvent,
): TransitionResult {
  const { state } = snapshot;

  switch (event.type) {
    case 'START_ALERT': {
      if (state !== 'DETECTED') return illegal;
      const sideEffects: SideEffect[] = [
        { kind: 'notifyHelpers', template: 'alert' },
        { kind: 'notifyFamily', template: 'searching' },
      ];
      if (event.helperCount > 0) {
        return move(snapshot, 'ALERTING', sideEffects);
      }
      // Waiting three minutes on nobody helps no one.
      return {
        ok: true,
        nextState: 'ALERTING',
        escalated: true,
        sideEffects: [
          ...sideEffects,
          { kind: 'notifyEscalation', reason: 'NO_HELPERS' },
        ],
      };
    }

    case 'ACCEPT':
      if (state === 'ACCEPTED' || state === 'ARRIVED') {
        return { ok: false, error: 'ALREADY_TAKEN' };
      }
      if (state !== 'ALERTING') return illegal;
      return move(snapshot, 'ACCEPTED', [
        { kind: 'replyAccepter' },
        { kind: 'notifyStandby', template: 'taken' },
        { kind: 'notifyFamily', template: 'going' },
        { kind: 'notifyKeyHolder' },
      ]);

    case 'DECLINE':
      if (state !== 'ALERTING') return illegal;
      return event.allDeclined
        ? escalate(snapshot, 'ALL_DECLINED')
        : stay(snapshot);

    case 'ARRIVE':
      if (state !== 'ACCEPTED') return illegal;
      return move(snapshot, 'ARRIVED', [
        { kind: 'notifyStandby', template: 'arrived' },
        { kind: 'notifyFamily', template: 'arrived' },
      ]);

    case 'ARRIVAL_TIMEOUT': {
      if (state !== 'ACCEPTED') return illegal;
      const sideEffects: SideEffect[] = [
        {
          kind: 'notifyHelpers',
          template: 'alert',
          exceptUserId: event.previousAccepterId,
        },
        { kind: 'notifyFamily', template: 'reopened' },
      ];
      if (event.helperCount > 0 || snapshot.escalated) {
        return move(snapshot, 'ALERTING', sideEffects);
      }
      return {
        ok: true,
        nextState: 'ALERTING',
        escalated: true,
        sideEffects: [
          ...sideEffects,
          { kind: 'notifyEscalation', reason: 'NO_HELPERS' },
        ],
      };
    }

    case 'NO_ACCEPT_TIMEOUT':
      if (state !== 'ALERTING') return illegal;
      if (snapshot.escalated) return { ok: false, error: 'ALREADY_ESCALATED' };
      return escalate(snapshot, 'NO_ACCEPT');

    case 'VOICE_OK':
      return afterVoiceOrStanding({ ...snapshot, voiceOk: true });

    case 'STANDING':
      return afterVoiceOrStanding({ ...snapshot, standing: true });

    case 'VOICE_HELP':
      return escalate(snapshot, 'VOICE_HELP');

    case 'NO_RESPONSE':
      return escalate(snapshot, 'NO_RESPONSE');

    case 'EMS_TRIGGERED':
      if (state !== 'ACCEPTED' && state !== 'ARRIVED') return illegal;
      return {
        ok: true,
        nextState: state,
        escalated: true,
        sideEffects: snapshot.escalated
          ? []
          : [{ kind: 'notifyFamily', template: 'ems' }],
      };

    case 'SUBMIT_SUMMARY':
      if (state !== 'ARRIVED') return illegal;
      return move(snapshot, 'RESOLVED', [
        { kind: 'notifyFamily', template: 'summary' },
      ]);

    case 'FAMILY_CLOSE':
      if (!isOpen(state) || state === 'DETECTED') return illegal;
      return move(snapshot, 'CLOSED_BY_FAMILY', [
        { kind: 'notifyHelpers', template: 'closed' },
      ]);
  }
}
