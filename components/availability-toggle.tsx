'use client';

import { Heart } from 'lucide-react';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';
import { clock } from '@/lib/time';

const LIMITS = [
  { hours: null, label: 'ไม่จำกัดเวลา' },
  { hours: 2, label: '2 ชั่วโมง' },
  { hours: 8, label: '8 ชั่วโมง' },
  { hours: 12, label: '12 ชั่วโมง' },
];

export function AvailabilityToggle({
  available,
  until,
}: {
  available: boolean;
  until: Date | null;
}) {
  const [on, setOn] = useState(available);
  const [end, setEnd] = useState(until);
  const [error, setError] = useState<string | null>(null);

  async function save(next: boolean, hours: number | null) {
    const previous = on;
    setOn(next);
    setError(null);
    const result = await postJson<{ availabilityUntil: string | null }>(
      '/api/liff/availability',
      { availability: next, hours },
    );
    if (result.ok) {
      setEnd(result.availabilityUntil ? new Date(result.availabilityUntil) : null);
    } else {
      setOn(previous);
      setError(result.error);
    }
  }

  return (
    <section id="availability" className="glass mt-4 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
          <Heart className="size-6" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="font-bold">พร้อมช่วยตอนนี้</p>
          <p className="text-sm text-muted">
            {!on
              ? 'ตอนนี้จะไม่ได้รับงานใหม่'
              : end
                ? `รับงานได้ถึง ${clock(end)} น.`
                : 'รับงานได้ตลอด'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="พร้อมช่วยตอนนี้"
          onClick={() => save(!on, null)}
          className="flex h-11 items-center"
        >
          <span
            className={`flex h-8 w-14 items-center rounded-full p-1 transition-colors ${on ? 'justify-end bg-primary-text' : 'justify-start bg-ink/25'}`}
          >
            <span className="size-6 rounded-full bg-white shadow" />
          </span>
        </button>
      </div>
      {on && (
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          รับงานได้นาน
          <select
            aria-label="รับงานได้นาน"
            defaultValue=""
            onChange={(event) =>
              save(true, event.target.value ? Number(event.target.value) : null)
            }
            className="field min-h-11 flex-1 py-1.5"
          >
            {LIMITS.map(({ hours, label }) => (
              <option key={label} value={hours ?? ''}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-urgent-text">
          {error}
        </p>
      )}
    </section>
  );
}
