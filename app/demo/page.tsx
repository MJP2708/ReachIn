import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DemoConsole } from '@/components/demo-console';
import { DemoLogin } from '@/components/demo-login';
import { db } from '@/lib/db';
import { demoEnabled, hasDemoAccess } from '@/lib/demo/guard';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'ReachIn · สาธิต',
  robots: { index: false },
};

export default async function DemoPage() {
  if (!demoEnabled()) notFound();
  if (!(await hasDemoAccess())) return <DemoLogin />;

  const [elders, users] = await Promise.all([
    db().elder.findMany({
      where: { isDemo: true },
      select: { id: true, name: true },
      orderBy: { name: 'desc' },
    }),
    db().user.findMany({
      where: { isDemo: true },
      select: { id: true, displayName: true },
      orderBy: { id: 'desc' },
    }),
  ]);

  return (
    <DemoConsole elders={elders} users={users} lineLive={env().LINE_ENABLED} />
  );
}
