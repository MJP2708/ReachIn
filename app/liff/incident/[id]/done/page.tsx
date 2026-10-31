import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SummaryForm } from '@/components/summary-form';
import { orNotFound, pageUser } from '@/lib/page-auth';
import { clock, minutesBetween } from '@/lib/time';
import { getIncidentView } from '@/lib/views';

export default async function DonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await pageUser();
  const view = await orNotFound(getIncidentView(user.id, id));

  if (!view.isAccepter) redirect(`/liff/incident/${id}/alert`);
  if (view.status === 'ACCEPTED') redirect(`/liff/incident/${id}/route`);

  const times = [
    { label: 'ล้ม', value: clock(view.detectedAt) },
    {
      label: `ถึงตัว${view.elder.title}`,
      value: view.arrivedAt ? clock(view.arrivedAt) : '-',
    },
    {
      label: 'รวมเวลา',
      value: view.arrivedAt
        ? `${minutesBetween(view.detectedAt, view.arrivedAt)} นาที`
        : '-',
    },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4">
      <header className="px-1">
        <h1 className="text-2xl font-bold">ขอบคุณ{user.displayName}</h1>
        <p className="text-muted">
          {view.status === 'RESOLVED'
            ? 'ส่งสรุปให้ลูกหลานแล้ว'
            : 'บันทึกสั้น ๆ แล้วส่งสรุปให้ลูกหลาน'}
        </p>
      </header>

      <section className="glass grid grid-cols-3 divide-x divide-ink/8 p-4 text-center">
        {times.map(({ label, value }) => (
          <div key={label}>
            <p className="text-sm text-muted">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        ))}
      </section>

      {view.status === 'ARRIVED' ? (
        <SummaryForm
          incidentId={id}
          title={view.elder.title}
          room={view.room}
          initialResult={view.guide?.emsTriggered ? 'EMS_CALLED' : 'OK'}
        />
      ) : (
        <section className="glass p-6 text-center">
          <CircleCheck className="mx-auto mb-2 size-10 text-primary-text" aria-hidden />
          <p className="text-lg font-bold">ลูกหลานได้รับสรุปแล้ว</p>
          <Link href="/liff/home" className="btn btn-soft mt-4">
            กลับหน้าแรก
          </Link>
        </section>
      )}
    </main>
  );
}
