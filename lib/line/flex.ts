import type { messagingApi } from '@line/bot-sdk';
import { EMS_NUMBER, EMS_URI } from './urls';

export type LineMessage = messagingApi.Message;

type Tone = 'urgent' | 'info' | 'ok';

export type CardButton =
  | { label: string; uri: string; primary?: boolean; urgent?: boolean }
  | {
      label: string;
      data: string;
      displayText: string;
      primary?: boolean;
      urgent?: boolean;
    };

export type Card = {
  tone: Tone;
  eyebrow: string;
  title: string;
  lines?: string[];
  rows?: Array<{ label: string; value: string }>;
  buttons?: CardButton[];
};

const COLOURS = {
  blue: '#0384FC',
  blueText: '#0369CE',
  orange: '#FC5E03',
  orangeText: '#A33A00',
  body: '#101828',
  muted: '#5A6472',
} as const;

const EYEBROW_COLOUR: Record<Tone, string> = {
  urgent: COLOURS.orangeText,
  info: COLOURS.blueText,
  ok: COLOURS.blueText,
};

function button(item: CardButton): messagingApi.FlexButton {
  const action: messagingApi.Action =
    'uri' in item
      ? { type: 'uri', label: item.label, uri: item.uri }
      : {
          type: 'postback',
          label: item.label,
          data: item.data,
          displayText: item.displayText,
        };
  const filled = item.primary || item.urgent;
  return {
    type: 'button',
    style: filled ? 'primary' : 'link',
    height: 'md',
    ...(filled && { color: item.urgent ? COLOURS.orange : COLOURS.blue }),
    action,
  };
}

/** A generic alt text: it shows on lock screens, so it never names anyone. */
export function card(altText: string, content: Card): LineMessage {
  const body: messagingApi.FlexComponent[] = [
    {
      type: 'text',
      text: content.eyebrow,
      size: 'sm',
      weight: 'bold',
      color: EYEBROW_COLOUR[content.tone],
    },
    {
      type: 'text',
      text: content.title,
      size: 'xl',
      weight: 'bold',
      wrap: true,
      color: COLOURS.body,
      margin: 'sm',
    },
    ...(content.lines ?? []).map(
      (text): messagingApi.FlexText => ({
        type: 'text',
        text,
        size: 'md',
        wrap: true,
        color: COLOURS.muted,
        margin: 'md',
      }),
    ),
    ...(content.rows ?? []).map(
      ({ label, value }): messagingApi.FlexBox => ({
        type: 'box',
        layout: 'baseline',
        margin: 'md',
        contents: [
          { type: 'text', text: label, size: 'sm', color: COLOURS.muted, flex: 2 },
          {
            type: 'text',
            text: value,
            size: 'md',
            weight: 'bold',
            wrap: true,
            color: COLOURS.body,
            flex: 3,
          },
        ],
      }),
    ),
  ];

  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', contents: body },
    ...(content.buttons?.length && {
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: content.buttons.map(button),
      },
    }),
  };

  return { type: 'flex', altText, contents: bubble };
}

export const emsButton: CardButton = {
  label: `โทร ${EMS_NUMBER}`,
  uri: EMS_URI,
  urgent: true,
};

export const acceptButton = (incidentId: string): CardButton => ({
  label: 'รับงาน ไปช่วยเลย',
  data: `action=accept&incident=${incidentId}`,
  displayText: 'รับงาน',
  primary: true,
});

export const declineButton = (incidentId: string): CardButton => ({
  label: 'ตอนนี้ไปไม่ได้',
  data: `action=decline&incident=${incidentId}`,
  displayText: 'ตอนนี้ไปไม่ได้',
});

export const keyButton = (incidentId: string): CardButton => ({
  label: 'ได้ ถือกุญแจไป',
  data: `action=key&incident=${incidentId}`,
  displayText: 'ได้ ถือกุญแจไป',
  primary: true,
});

export type ChatButton = {
  label: string;
  primary: boolean;
  urgent: boolean;
  /** Exactly one of these is set. */
  data?: string;
  displayText?: string;
  uri?: string;
};

export type ChatCard = {
  eyebrow: string;
  eyebrowColour: string;
  title: string;
  lines: string[];
  rows: Array<{ label: string; value: string }>;
  buttons: ChatButton[];
};

const textOf = (node: messagingApi.FlexComponent | undefined) =>
  node?.type === 'text' ? (node.text ?? '') : '';

/** Read a card back from the Flex JSON, so the simulated chat shows what was queued. */
export function parseCard(message: LineMessage): ChatCard | null {
  if (message.type !== 'flex') return null;
  const bubble = message.contents as messagingApi.FlexBubble;
  const [eyebrow, title, ...rest] = bubble.body?.contents ?? [];
  const footer = bubble.footer?.contents ?? [];

  return {
    eyebrow: textOf(eyebrow),
    eyebrowColour:
      (eyebrow?.type === 'text' && eyebrow.color) || COLOURS.blueText,
    title: textOf(title),
    lines: rest.filter((node) => node.type === 'text').map(textOf),
    rows: rest.flatMap((node) =>
      node.type === 'box'
        ? [{ label: textOf(node.contents[0]), value: textOf(node.contents[1]) }]
        : [],
    ),
    buttons: footer.flatMap((node) => {
      if (node.type !== 'button') return [];
      const action = node.action as {
        label: string;
        data?: string;
        displayText?: string;
        uri?: string;
      };
      return [
        {
          label: action.label,
          primary: node.style === 'primary',
          urgent: node.color === COLOURS.orange,
          data: action.data,
          displayText: action.displayText,
          uri: action.uri,
        },
      ];
    }),
  };
}

/** Plain-language view of a card, for the demo feed. */
export function describeCard(message: LineMessage): string {
  if (message.type === 'text') return message.text;
  if (message.type !== 'flex') return message.type;
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const item = node as { type?: string; text?: string; contents?: unknown; body?: unknown; footer?: unknown; action?: { label?: string } };
    if (item.type === 'text' && item.text) texts.push(item.text);
    if (item.type === 'button' && item.action?.label) {
      texts.push(`[${item.action.label}]`);
    }
    if (Array.isArray(item.contents)) item.contents.forEach(walk);
    else walk(item.contents);
    walk(item.body);
    walk(item.footer);
  };
  walk(message);
  return texts.join(' · ');
}
