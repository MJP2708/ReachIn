import { redirect } from 'next/navigation';
import { GuideFlow } from '@/components/guide-flow';
import { orNotFound, pageUser } from '@/lib/page-auth';
import { clock } from '@/lib/time';
import { getIncidentView } from '@/lib/views';

const strings = (value: unknown) => (value ?? []) as string[];

export default async function GuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await pageUser();
  const view = await orNotFound(getIncidentView(user.id, id));

  if (view.isAccepter && view.status === 'ACCEPTED') {
    redirect(`/liff/incident/${id}/route`);
  }
  if (view.isAccepter && view.status === 'RESOLVED') {
    redirect(`/liff/incident/${id}/done`);
  }
  if (!view.isAccepter || view.status !== 'ARRIVED') {
    redirect(`/liff/incident/${id}/alert`);
  }

  const { elder, guide } = view;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4">
      <header className="px-1">
        <h1 className="text-lg font-bold">คู่มือช่วยเหลือ · {elder.name}</h1>
        {view.arrivedAt && (
          <p className="text-sm text-muted">ถึงแล้ว {clock(view.arrivedAt)}</p>
        )}
      </header>
      <GuideFlow
        incidentId={id}
        doneHref={`/liff/incident/${id}/done`}
        elder={{
          title: elder.title,
          sex: elder.sex,
          age: elder.age,
          address: elder.address,
          room: view.room,
          keyMedications:
            view.private?.medications
              .filter((medication) => medication.warning)
              .map((medication) => medication.name) ?? [],
        }}
        initial={
          guide && {
            step: guide.step,
            safetyChecks: strings(guide.safetyChecks),
            redFlags: strings(guide.redFlags),
            moves: strings(guide.moves),
            watchChecks: strings(guide.watchChecks),
            emsTriggered: guide.emsTriggered,
          }
        }
      />
    </main>
  );
}
