'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { postJson } from '@/lib/client-api';
import type { FeedItem } from '@/lib/demo/feed';
import { clock } from '@/lib/time';

type Feed = {
  incident: {
    id: string;
    status: string;
    escalated: boolean;
    elderName: string;
    accepterName: string | null;
    alertedCount: number;
  } | null;
  items: FeedItem[];
};

const SIMULATOR = [
  { type: 'FALL', label: 'ล้ม (FALL)', urgent: true },
  { type: 'VOICE_OK', label: 'ตอบ "ไม่เป็นไร" (VOICE_OK)' },
  { type: 'STANDING', label: 'ลุกยืน (STANDING)' },
  { type: 'VOICE_HELP', label: 'ตอบ "ช่วยด้วย" (VOICE_HELP)' },
  { type: 'NO_RESPONSE', label: 'ไม่ตอบ ไม่ขยับ (NO_RESPONSE)' },
  { type: 'HEARTBEAT', label: 'สัญญาณชีพกล่อง (HEARTBEAT)' },
] as const;

const STATUS_TEXT: Record<string, string> = {
  PENDING: 'รอส่ง',
  SENT: 'ส่งทาง LINE แล้ว',
  SIMULATED: 'จำลอง',
  FAILED: 'ส่งไม่สำเร็จ',
};

export function DemoConsole({
  elders,
  users,
  lineLive,
}: {
  elders: Array<{ id: string; name: string }>;
  users: Array<{ id: string; displayName: string }>;
  lineLive: boolean;
}) {
  const [elderId, setElderId] = useState(elders[0]?.id ?? '');
  const [userId, setUserId] = useState(users[0]?.id ?? '');
  const [actingAs, setActingAs] = useState<string | null>(null);
  const [feed, setFeed] = useState<Feed>({ incident: null, items: [] });
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/demo/feed', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setFeed((await res.json()) as Feed);
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 1500);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  async function call(url: string, body: unknown, done?: string) {
    const result = await postJson(url, body);
    setNotice(result.ok ? (done ?? null) : result.error);
    void refresh();
    return result;
  }

  async function actAs() {
    const result = await postJson<{ displayName: string }>('/api/demo/act-as', { userId });
    if (result.ok) setActingAs(result.displayName);
    setNotice(result.ok ? null : result.error);
  }

  function placeHere() {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        void call(
          '/api/demo/place',
          { elderId, lat: coords.latitude, lng: coords.longitude },
          'ย้ายบ้านมาไว้ที่ตำแหน่งนี้แล้ว',
        ),
      () => setNotice('หาตำแหน่งไม่สำเร็จ'),
    );
  }

  const incident = feed.incident;

  return (
    <main className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <header className="glass p-4">
          <h1 className="text-xl font-bold">ReachIn · โหมดสาธิต</h1>
          <p className="text-sm text-muted">
            ข้อมูลทั้งหมดเป็นตัวอย่างสมมติ · LINE: {lineLive ? 'เปิด' : 'ปิด (แสดงในฟีดเท่านั้น)'}
          </p>
        </header>

        <section className="glass flex flex-col gap-2 p-4">
          <h2 className="font-bold">กล่องในห้องน้ำ</h2>
          <label>
            ผู้สูงอายุ
            <select
              value={elderId}
              onChange={(event) => setElderId(event.target.value)}
              className="field mt-1"
            >
              {elders.map((elder) => (
                <option key={elder.id} value={elder.id}>
                  {elder.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {SIMULATOR.map(({ type, label, ...rest }) => (
              <button
                key={type}
                type="button"
                data-testid={`sim-${type}`}
                onClick={() => call('/api/demo/event', { elderId, type })}
                className={`btn ${'urgent' in rest ? 'btn-urgent' : 'btn-soft'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="glass flex flex-col gap-2 p-4">
          <h2 className="font-bold">เวลา</h2>
          <button
            type="button"
            data-testid="tick"
            onClick={() => call('/api/demo/tick', { fastForward: false }, 'ตรวจเวลาแล้ว')}
            className="btn btn-soft"
          >
            ตรวจเวลาตอนนี้
          </button>
          <button
            type="button"
            data-testid="tick-fast"
            onClick={() => call('/api/demo/tick', { fastForward: true }, 'เร่งเวลา 60 นาทีแล้ว')}
            className="btn btn-soft"
          >
            เร่งเวลา 60 นาที (หมดเวลาทุกตัวจับเวลา)
          </button>
        </section>

        <section className="glass flex flex-col gap-2 p-4">
          <h2 className="font-bold">เล่นเป็น</h2>
          <label>
            คนในวง
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="field mt-1"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
          <button type="button" data-testid="act-as" onClick={actAs} className="btn btn-primary">
            เล่นเป็นคนนี้
          </button>
          {actingAs && (
            <output className="block text-sm text-muted">
              ตอนนี้เล่นเป็น {actingAs}
            </output>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Link href="/liff/line" prefetch={false} className="btn btn-soft">
              แชต LINE จำลอง
            </Link>
            <Link href="/liff/home" prefetch={false} className="btn btn-soft">
              หน้าแรก
            </Link>
            {incident && (
              <Link
                href={`/liff/incident/${incident.id}/alert`}
                prefetch={false}
                data-testid="open-incident"
                className="btn btn-soft"
              >
                เปิดเหตุล่าสุด
              </Link>
            )}
          </div>
        </section>

        <section className="glass flex flex-col gap-2 p-4">
          <h2 className="font-bold">ตำแหน่ง</h2>
          <button type="button" onClick={placeHere} className="btn btn-soft">
            ย้ายบ้านมาไว้ที่ตำแหน่งนี้
          </button>
          {incident && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="arrive-50"
                onClick={() =>
                  call('/api/demo/arrive', { incidentId: incident.id, distanceM: 50 }, 'ยืนยันการถึงแล้ว')
                }
                className="btn btn-soft"
              >
                ถึงที่ระยะ 50 ม.
              </button>
              <button
                type="button"
                data-testid="arrive-500"
                onClick={() =>
                  call('/api/demo/arrive', { incidentId: incident.id, distanceM: 500 })
                }
                className="btn btn-soft"
              >
                ลองที่ระยะ 500 ม.
              </button>
            </div>
          )}
        </section>

        <button
          type="button"
          data-testid="reset"
          onClick={() => call('/api/demo/reset', {}, 'รีเซ็ตข้อมูลสาธิตแล้ว')}
          className="btn btn-quiet"
        >
          รีเซ็ตข้อมูลสาธิต
        </button>
        {notice && (
          <output data-testid="notice" className="block text-center font-semibold text-primary-text">
            {notice}
          </output>
        )}
      </div>

      <section className="glass flex max-h-[calc(100dvh-2rem)] flex-col p-4 md:sticky md:top-4">
        <h2 className="font-bold">กิจกรรมล่าสุด</h2>
        {incident && (
          <p data-testid="incident-status" className="mb-2 text-sm text-muted">
            {incident.elderName} · {incident.status}
            {incident.escalated && ' · ESCALATED'}
            {incident.accepterName && ` · ${incident.accepterName}`}
          </p>
        )}
        <ol data-testid="feed" className="flex-1 space-y-2 overflow-y-auto">
          {feed.items.length === 0 && <li className="text-muted">ยังไม่มีกิจกรรม</li>}
          {feed.items.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl p-3 text-sm ${item.kind === 'message' ? 'bg-primary-soft' : 'bg-white/80'}`}
            >
              <p className="font-semibold">
                {clock(new Date(item.at))} · {item.label}
                {item.status && ` · ${STATUS_TEXT[item.status] ?? item.status}`}
              </p>
              {item.detail && <p className="text-muted">{item.detail}</p>}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
