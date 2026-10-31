import type { ReactNode } from 'react';
import { LiffGate } from '@/components/liff-gate';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { demoOpen, liffEnabled } from '@/lib/demo/guard';

export const dynamic = 'force-dynamic';

export default async function InviteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user && demoOpen() && !liffEnabled()) redirect('/');
  return user ? children : <LiffGate />;
}
