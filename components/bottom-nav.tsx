'use client';

import { Bell, Clock, Home, Menu, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/liff/home', label: 'หน้าแรก', icon: Home, match: ['/liff/home'] },
  { href: '/liff/history', label: 'ประวัติ', icon: Clock, match: ['/liff/history'] },
  { href: '/liff/elders', label: 'ผู้สูงอายุ', icon: UserRound, match: ['/liff/elders', '/liff/elder/'] },
  { href: '/liff/notifications', label: 'แจ้งเตือน', icon: Bell, match: ['/liff/notifications'] },
  { href: '/liff/menu', label: 'เมนู', icon: Menu, match: ['/liff/menu', '/liff/settings', '/liff/practice'] },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-3 z-40 mx-auto w-[calc(100%-24px)] max-w-md"
    >
      <ul className="glass flex rounded-[28px] bg-white/85 p-1.5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match.some((prefix) => pathname.startsWith(prefix));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[22px] text-xs font-semibold ${active ? 'bg-white text-primary-text shadow-glass' : 'text-ink/80'}`}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
