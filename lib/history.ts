import type { getHistory } from '@/lib/views';
import { monthKey } from '@/lib/time';

export type HistoryItem = Awaited<ReturnType<typeof getHistory>>[number];

export const RESULT_TEXT = {
  OK: 'ลุกได้ ไม่บาดเจ็บ',
  MINOR_INJURY: 'บาดเจ็บเล็กน้อย',
  EMS_CALLED: 'โทร 1669',
} as const;

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** The last six months, oldest first, with empty months kept. */
export function monthBuckets(
  items: Array<{ detectedAt: Date | string }>,
  now = new Date(),
) {
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 15);
    return {
      key: monthKey(date),
      label: MONTHS[date.getMonth()]!,
      count: 0,
    };
  });
  for (const item of items) {
    const key = monthKey(new Date(item.detectedAt));
    const bucket = buckets.find((candidate) => candidate.key === key);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}
