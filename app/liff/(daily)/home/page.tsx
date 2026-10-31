import { Bell, BookOpenCheck, ChevronRight, Siren } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AvailabilityToggle } from '@/components/availability-toggle';
import { ElderCard } from '@/components/elder-card';
import { Logo } from '@/components/logo';
import { pageUser } from '@/lib/page-auth';
import { todayLabel } from '@/lib/time';
import { getHome } from '@/lib/views';

function Stat({
  value,
  unit,
  label,
}: {
  value: string | number;
  unit?: string;
  label: ReactNode;
}) {
  return (
    <div className="glass p-3.5">
      <p className="text-2xl font-bold">
        {value} {unit && <span className="text-sm text-primary-text">{unit}</span>}
      </p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}

export default async function HomePage() {
  const user = await pageUser();
  const { stats, elders, activeIncidentId } = await getHome(user);

  return (
    <main>
      <header className="glass flex items-center justify-between rounded-full px-4 py-2.5">
        <Logo />
        <Link
          href="/liff/notifications"
          aria-label="การแจ้งเตือน"
          className="flex size-11 items-center justify-center"
        >
          <Bell className="size-6" aria-hidden />
        </Link>
      </header>

      <p className="mt-5 text-sm text-muted">วันนี้ · {todayLabel()}</p>
      <h1 className="text-[28px] font-bold">สวัสดี {user.displayName}</h1>

      {activeIncidentId && (
        <Link
          href={`/liff/incident/${activeIncidentId}/alert`}
          className="mt-3 flex min-h-16 items-center gap-3 rounded-card border border-urgent bg-urgent-soft p-4 font-bold text-urgent-text"
        >
          <Siren className="size-6 shrink-0" aria-hidden />
          มีเหตุที่ต้องการคนช่วยตอนนี้
          <ChevronRight className="ml-auto size-5" aria-hidden />
        </Link>
      )}

      <AvailabilityToggle
        available={user.availability}
        until={user.availabilityUntil}
      />

      <section className="mt-3 grid grid-cols-3 gap-2.5" aria-label="สถิติเดือนนี้">
        <Stat value={stats.helped} label="ครั้งที่ไปช่วย เดือนนี้" />
        <Stat
          value={stats.averageArrival ?? '-'}
          unit={stats.averageArrival === null ? undefined : 'นาที'}
          label="ไปถึงเฉลี่ย"
        />
        <Stat
          value={stats.standby}
          label={
            <>
              ครั้งที่
              <br />
              สแตนด์บาย
            </>
          }
        />
      </section>

      <div className="mt-5 mb-2 flex items-center justify-between">
        <h2 className="font-bold">ผู้สูงอายุที่ฉันดูแล · {elders.length}</h2>
        <Link
          href="/liff/elders"
          className="flex min-h-11 items-center text-sm font-semibold text-primary-text"
        >
          ดูทั้งหมด
        </Link>
      </div>

      {elders.length === 0 ? (
        <p className="glass p-5 text-center text-muted">
          ยังไม่ได้อยู่ในวงของใคร เปิดลิงก์เชิญจากลูกหลาน หรือ
          <Link href="/liff/register" className="btn btn-soft mt-3">
            ลงทะเบียนผู้สูงอายุ
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {elders.map((elder) => (
            <ElderCard key={elder.id} elder={elder} />
          ))}
        </div>
      )}

      <Link
        href="/liff/practice"
        className="mt-3 flex min-h-14 items-center gap-3 rounded-[20px] border border-dashed border-primary/40 p-3.5 font-semibold"
      >
        <BookOpenCheck className="size-5 text-primary-text" aria-hidden />
        ซ้อมคู่มือช่วยคนล้ม 3 นาที
        <ChevronRight className="ml-auto size-5 text-muted" aria-hidden />
      </Link>
    </main>
  );
}
