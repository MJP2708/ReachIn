import Link from 'next/link';
import { DistanceLabel } from '@/components/live-distance';
import { WATCH_FALL_COUNT, ROLE_LABEL } from '@/lib/views';
import type { getHome } from '@/lib/views';

type Elder = Awaited<ReturnType<typeof getHome>>['elders'][number];

export function ElderCard({ elder }: { elder: Elder }) {
  const watch = elder.recentFalls >= WATCH_FALL_COUNT;
  return (
    <Link href={`/liff/elder/${elder.id}`} className="glass flex items-center gap-3 p-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary-text">
        {elder.name.replace(/^คุณ(ยาย|ตา)?/, '')[0]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">
          {elder.name} · {elder.age} ปี
        </span>
        <span className="block text-sm text-muted">
          <DistanceLabel lat={elder.lat} lng={elder.lng} suffix=" · " />
          {ROLE_LABEL[elder.role]}
          {elder.recentFalls > 0 && ` · ล้ม ${elder.recentFalls} ครั้งใน 30 วัน`}
        </span>
      </span>
      <span
        className={`chip ${watch ? 'bg-urgent-soft text-urgent-text' : 'bg-primary-soft text-primary-text'}`}
      >
        {watch ? 'เฝ้าระวัง' : 'ปกติ'}
      </span>
    </Link>
  );
}
