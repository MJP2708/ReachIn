import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { DemoBar } from '@/components/demo-bar';
import { LiffGate } from '@/components/liff-gate';
import { currentUser } from '@/lib/auth/session';
import { demoOpen, liffEnabled } from '@/lib/demo/guard';

export const dynamic = 'force-dynamic';

export default async function LiffLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!demoOpen()) return user ? children : <LiffGate />;
  if (!user) {
    if (liffEnabled()) return <LiffGate />;
    redirect('/');
  }
  // Real accounts look after real elders, so nothing here pretends for them.
  return user.isDemo ? (
    <DemoBar name={user.displayName}>{children}</DemoBar>
  ) : (
    children
  );
}
