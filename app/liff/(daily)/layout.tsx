import type { ReactNode } from 'react';
import { BottomNav } from '@/components/bottom-nav';

export default function DailyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-md p-4 pb-28">{children}</div>
      <BottomNav />
    </>
  );
}
