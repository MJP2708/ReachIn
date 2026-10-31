'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { postJson } from '@/lib/client-api';
import type { ChatButton, ChatCard } from '@/lib/line/flex';
import { clock } from '@/lib/time';
import { ShareToLine } from './share-to-line';

type ChatMessage = { id: string; at: string; card: ChatCard };
type Person = { id: string; displayName: string };
type OpenIncident = { id: string; elderName: string };
type SentText = { id: string; at: string; text: string };

const POLL_MS = 2000;

/** Links inside the app stay inside it, whatever host built the card. */
const inAppPath = (uri: string) => {
  const index = uri.indexOf('/liff/');
  return index >= 0 ? uri.slice(index) : null;
};

function CardButton({
  button,
  onPostback,
}: {
  button: ChatButton;
  onPostback: (button: ChatButton) => void;
}) {
  const className = `flex min-h-11 w-full items-center justify-center rounded-lg px-3 text-center font-bold ${
    button.urgent
      ? 'bg-urgent-text text-white'
      : button.primary
        ? 'bg-primary-text text-white'
        : 'text-primary-text'
  }`;

  if (!button.uri) {
    return (
      <button type="button" onClick={() => onPostback(button)} className={className}>
        {button.label}
      </button>
    );
  }
  const path = inAppPath(button.uri);
  return path ? (
    <Link href={path} prefetch={false} className={className}>
      {button.label}
    </Link>
  ) : (
    <a href={button.uri} className={className}>
      {button.label}
    </a>
  );
}

function Bubble({
  message,
  onPostback,
}: {
  message: ChatMessage;
  onPostback: (button: ChatButton) => void;
}) {
  const { card } = message;
  return (
    <li className="flex items-end gap-1.5">
      <div className="w-[82%] max-w-80 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="p-4">
          <p className="text-sm font-bold" style={{ color: card.eyebrowColour }}>
            {card.eyebrow}
          </p>
          <p className="mt-1 text-xl leading-snug font-bold">{card.title}</p>
          {card.lines.map((line) => (
            <p key={line} className="mt-2 text-muted">
              {line}
            </p>
          ))}
          {card.rows.map(({ label, value }) => (
            <p key={label} className="mt-2 flex gap-2">
              <span className="w-2/5 text-sm text-muted">{label}</span>
              <span className="flex-1 font-bold">{value}</span>
            </p>
          ))}
        </div>
        {card.buttons.length > 0 && (
          <div className="flex flex-col gap-1.5 px-3 pb-3">
            {card.buttons.map((button) => (
              <CardButton key={button.label} button={button} onPostback={onPostback} />
            ))}
          </div>
        )}
      </div>
      <time className="text-xs text-white">{clock(new Date(message.at))}</time>
    </li>
  );
}

/**
 * LINE as the demo's stand-in: the same cards the real system would send, read
 * back from the outbox, with buttons that run the real postback handler.
 */
export function LineChat({
  people,
  currentId,
  currentName,
}: {
  people: Person[];
  currentId: string;
  currentName: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sent, setSent] = useState<SentText[]>([]);
  const [open, setOpen] = useState<OpenIncident | null>(null);
  const end = useRef<HTMLLIElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/demo/chat', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as {
        messages: ChatMessage[];
        open: OpenIncident | null;
      };
      setMessages(data.messages);
      setOpen(data.open);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, sent.length]);

  async function postback(button: ChatButton) {
    const text = button.displayText;
    if (text) {
      const at = new Date().toISOString();
      setSent((list) => [...list, { id: `sent-${at}`, at, text }]);
    }
    await postJson('/api/demo/postback', { data: button.data });
    void load();
  }

  async function switchTo(userId: string) {
    await postJson('/api/demo/act-as', { userId });
    setSent([]);
    setMessages([]);
    router.refresh();
    void load();
  }

  const timeline = [...messages, ...sent].sort((a, b) =>
    a.at.localeCompare(b.at),
  );

  return (
    <main className="flex h-[calc(100dvh-var(--demo-bar,0px))] flex-col bg-[#7494C0]">
      <header className="mx-auto w-full max-w-md bg-[#1F2C3D] px-4 py-2 text-white">
        <h1 className="font-bold">ReachIn</h1>
        <p className="text-sm text-white/80">
          จำลองหน้าแชต LINE ของ{currentName}
        </p>
      </header>

      <div className="mx-auto w-full max-w-md overflow-x-auto bg-[#1F2C3D] px-3 pb-2">
        <div className="flex gap-1.5">
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              aria-pressed={person.id === currentId}
              onClick={() => switchTo(person.id)}
              className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold ${person.id === currentId ? 'bg-white text-ink' : 'bg-white/15 text-white'}`}
            >
              {person.displayName}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="mx-auto w-full max-w-md bg-[#1F2C3D] px-3 pb-2">
          <ShareToLine
            incidentId={open.id}
            elderName={open.elderName}
            demo
            compact
          />
        </div>
      )}

      <ol
        data-testid="line-chat"
        className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto p-3"
      >
        {messages.length === 0 && (
          <li className="rounded-2xl bg-white/90 p-4 text-center text-muted">
            ยังไม่มีข้อความ
          </li>
        )}
        {timeline.map((item) =>
          'card' in item ? (
            <Bubble key={item.id} message={item} onPostback={postback} />
          ) : (
            <li key={item.id} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl bg-[#06C755] px-3.5 py-2 font-semibold text-ink">
                {item.text}
              </p>
            </li>
          ),
        )}
        <li ref={end} aria-hidden />
      </ol>
    </main>
  );
}
