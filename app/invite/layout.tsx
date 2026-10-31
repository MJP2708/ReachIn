import type { ReactNode } from 'react';
import { LiffGate } from '@/components/liff-gate';
import { currentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function InviteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return user ? children : <LiffGate />;
}
