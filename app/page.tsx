import { redirect } from 'next/navigation';
import { LiffGate } from '@/components/liff-gate';
import { currentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function Root({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // liff.state means LINE is mid-redirect: only liff.init() can finish it.
  const midRedirect = 'liff.state' in params;
  if (!midRedirect && (await currentUser())) redirect('/liff/home');
  return <LiffGate then={midRedirect ? undefined : '/liff/home'} />;
}
