import type { ReactNode } from 'react';
import { DemoTelGuard } from '@/components/demo-tel-guard';
import { db } from '@/lib/db';

/** Someone real can join a fictional incident; its call buttons still must not dial. */
export default async function IncidentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fictional = await db().incident.count({
    where: { id, elder: { isDemo: true } },
  });
  return (
    <>
      {children}
      {fictional > 0 && <DemoTelGuard />}
    </>
  );
}
