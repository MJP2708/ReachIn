import {
  Bell,
  BookOpenCheck,
  CalendarClock,
  Clock,
  Home,
  Phone,
  Pill,
  Settings,
  UserRound,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { pageUser } from '@/lib/page-auth';

const TILES = [
  { href: '/liff/home', label: 'หน้าแรก', icon: Home },
  { href: '/liff/history', label: 'ประวัติ', icon: Clock },
  { href: '/liff/elders', label: 'ผู้สูงอายุ', icon: UserRound },
  { href: '/liff/elders', label: 'ยาประจำ', icon: Pill },
  { href: '/liff/home#availability', label: 'เวลาที่ฉันว่าง', icon: CalendarClock },
  { href: '/liff/practice', label: 'ซ้อมคู่มือ', icon: BookOpenCheck },
  { href: '/liff/elders', label: 'วงคนช่วย', icon: UsersRound },
  { href: '/liff/notifications', label: 'แจ้งเตือน', icon: Bell },
  { href: '/liff/settings', label: 'ตั้งค่า', icon: Settings },
];

export default async function MenuPage() {
  await pageUser();
  return (
    <main className="flex min-h-[calc(100dvh-9rem)] flex-col justify-end">
      <section className="glass bg-white/85 p-5">
        <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-ink/15" aria-hidden />
        <h1 className="mb-3 text-xl font-bold">เมนู</h1>
        <ul className="grid grid-cols-3 gap-2.5">
          {TILES.map(({ href, label, icon: Icon }) => (
            <li key={label}>
              <Link
                href={href}
                className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-[20px] bg-white/85 p-2 text-center text-sm font-semibold"
              >
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <a
          href="tel:1669"
          className="mt-3 flex min-h-14 items-center gap-3 rounded-[20px] bg-urgent-soft p-3.5 font-bold text-urgent-text"
        >
          <Phone className="size-5" aria-hidden /> โทร 1669 ฉุกเฉิน
        </a>
      </section>
    </main>
  );
}
