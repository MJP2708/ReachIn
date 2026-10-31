'use client';

import { useMemo, useState } from 'react';
import { RESULT_TEXT, monthBuckets, type HistoryItem } from '@/lib/history';
import { shortDate } from '@/lib/time';

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'helped', label: 'ฉันไปช่วย' },
  { value: 'standby', label: 'สแตนด์บาย' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

const WIDTH = 320;
const HEIGHT = 140;
const BASELINE = 112;
const BAR_WIDTH = 24;

function Chart({ items }: { items: HistoryItem[] }) {
  const buckets = monthBuckets(items);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const peak = buckets.reduce((best, bucket) =>
    bucket.count >= best.count ? bucket : best,
  );
  const slot = WIDTH / buckets.length;

  return (
    <figure>
      <figcaption className="sr-only">
        {buckets.map((b) => `${b.label} ${b.count} ครั้ง`).join(', ')}
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" aria-hidden>
        <line x1="0" x2={WIDTH} y1={BASELINE} y2={BASELINE} stroke="#101828" strokeOpacity="0.1" />
        {buckets.map((bucket, index) => {
          const x = slot * index + (slot - BAR_WIDTH) / 2;
          const height = bucket.count ? Math.max(6, (bucket.count / max) * 88) : 0;
          const y = BASELINE - height;
          return (
            <g key={bucket.key}>
              <title>{`${bucket.label}: ${bucket.count} ครั้ง`}</title>
              <rect x={x - 6} y="0" width={BAR_WIDTH + 12} height={HEIGHT} fill="transparent" />
              {height > 0 && (
                <path
                  d={`M${x} ${BASELINE}V${y + 4}q0-4 4-4h${BAR_WIDTH - 8}q4 0 4 4V${BASELINE}z`}
                  fill="#0384FC"
                />
              )}
              {bucket === peak && bucket.count > 0 && (
                <text x={x + BAR_WIDTH / 2} y={y - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="#101828">
                  {bucket.count}
                </text>
              )}
              <text x={x + BAR_WIDTH / 2} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="#5A6472">
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function detail(item: HistoryItem): string {
  if (item.status === 'CANCELLED_SELF') return 'ลุกได้เอง · ระบบยกเลิกงาน';
  if (item.status === 'CLOSED_BY_FAMILY') return 'ครอบครัวปิดเหตุการณ์';
  if (item.kind === 'standby') {
    return item.accepterName
      ? `คุณสแตนด์บาย · ${item.accepterName}ไปช่วย`
      : 'คุณสแตนด์บาย';
  }
  const arrival =
    item.arrivalMinutes === null ? '' : ` · ถึงใน ${item.arrivalMinutes} นาที`;
  const result = item.outcome ? ` · ${RESULT_TEXT[item.outcome]}` : '';
  return `คุณไปช่วย${arrival}${result}`;
}

export function HistoryView({ items }: { items: HistoryItem[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const shown = useMemo(
    () =>
      filter === 'all' ? items : items.filter((item) => item.kind === filter),
    [filter, items],
  );

  return (
    <>
      <section className="glass mt-3 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-bold">ความถี่ 6 เดือน</h2>
          <p className="text-sm text-muted">{items.length} ครั้ง</p>
        </div>
        <Chart items={items} />
      </section>

      <div role="group" aria-label="ตัวกรอง" className="my-3 flex gap-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`chip min-h-11 px-4 ${filter === value ? 'bg-primary-text text-white' : 'bg-white/80 text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2.5">
        {shown.length === 0 && (
          <li className="glass p-5 text-center text-muted">ยังไม่มีรายการ</li>
        )}
        {shown.map((item) => (
          <li key={item.id} className="glass p-4">
            <div className="flex justify-between gap-2">
              <p className="font-bold">
                {item.elderName} · {item.room}
              </p>
              <p className="shrink-0 text-sm text-muted">
                {shortDate(new Date(item.detectedAt))}
              </p>
            </div>
            <p className="text-sm text-muted">{detail(item)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
