import { ArrowLeft, Key, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArriveButton } from '@/components/arrive-button';
import { DemoArrive } from '@/components/demo-arrive';
import { RouteMap } from '@/components/route-map';
import { googleMapsUrl } from '@/lib/line/urls';
import { orNotFound, pageUser } from '@/lib/page-auth';
import { clock } from '@/lib/time';
import { getIncidentView } from '@/lib/views';

export default async function RoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await pageUser();
  const view = await orNotFound(getIncidentView(user.id, id));

  if (!view.isAccepter || view.status !== 'ACCEPTED') {
    redirect(`/liff/incident/${id}/alert`);
  }
  const { elder } = view;
  const keyHolder = view.private?.keyHolder;

  return (
    <main className="relative flex h-[calc(100dvh-var(--demo-bar,0px))] flex-col">
      <div className="absolute inset-0 bottom-[360px] isolate">
        <RouteMap target={elder} label={`บ้าน${elder.name}`} />
      </div>

      <header className="relative z-[500] mx-auto flex w-full max-w-md items-center gap-2 p-4">
        <Link
          href="/liff/home"
          aria-label="กลับหน้าแรก"
          className="glass flex size-12 items-center justify-center rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="glass flex-1 rounded-full px-4 py-3 font-bold">
          กำลังไปหา{elder.title}
        </h1>
      </header>

      <section className="relative z-[500] mx-auto mt-auto w-full max-w-md rounded-t-[28px] bg-white p-5 pb-6 shadow-glass-lg">
        <div className="flex items-start justify-between gap-2">
          <div>
            {view.acceptedAt && (
              <p className="text-sm font-semibold text-primary-text">
                คุณรับงานแล้ว · {clock(view.acceptedAt)}
              </p>
            )}
            <p className="text-xl font-bold">บ้าน{elder.name}</p>
          </div>
          <span className="chip bg-ink/5 text-muted">
            อีก {view.standbyCount} คนสแตนด์บาย
          </span>
        </div>

        <div className="mt-3 divide-y divide-ink/8 rounded-[20px] border border-ink/8">
          <div className="flex gap-3 p-3.5">
            <MapPin className="mt-0.5 size-5 shrink-0 text-urgent" aria-hidden />
            <div>
              <p className="font-semibold">{elder.address}</p>
              {view.private?.notes && (
                <p className="text-sm text-muted">{view.private.notes}</p>
              )}
            </div>
          </div>
          {keyHolder && !keyHolder.isViewer && (
            <div className="flex items-center gap-3 p-3.5">
              <Key className="size-5 shrink-0 text-primary-text" aria-hidden />
              <p className="flex-1 font-semibold">
                {keyHolder.confirmed
                  ? `${keyHolder.name}ถือกุญแจ รอที่หน้าบ้าน`
                  : `กุญแจสำรองอยู่กับ${keyHolder.name}`}
              </p>
              {keyHolder.phone && (
                <a
                  href={`tel:${keyHolder.phone}`}
                  aria-label={`โทรหา${keyHolder.name}`}
                  className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-text"
                >
                  <Phone className="size-5" aria-hidden />
                </a>
              )}
            </div>
          )}
        </div>

        {view.isDemoElder ? (
          <DemoArrive incidentId={id} label={`ฉันถึงบ้าน${elder.title}แล้ว`} />
        ) : (
          <div className="mt-3 flex">
            <ArriveButton
              incidentId={id}
              label={`ฉันถึงบ้าน${elder.title}แล้ว`}
            />
          </div>
        )}
        <a
          href={googleMapsUrl(elder.lat, elder.lng)}
          target="_blank"
          rel="noreferrer"
          className="btn mt-1 font-semibold text-primary-text"
        >
          เปิดเส้นทางใน Google Maps
        </a>
      </section>
    </main>
  );
}
