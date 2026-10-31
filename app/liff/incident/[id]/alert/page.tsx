import { Key, MapPin, MicOff, Phone } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertActions } from '@/components/alert-actions';
import { AutoRefresh } from '@/components/auto-refresh';
import { EmergencyHeader } from '@/components/emergency-header';
import { FamilyClose } from '@/components/family-close';
import { DistanceStat } from '@/components/live-distance';
import { JoinDemo } from '@/components/join-demo';
import { ShareToLine } from '@/components/share-to-line';
import { demoOpen } from '@/lib/demo/guard';
import { demoElderToJoin } from '@/lib/demo/join';
import { orNotFound, pageUser } from '@/lib/page-auth';
import { clock, minutesSince } from '@/lib/time';
import { getIncidentView, type IncidentView } from '@/lib/views';

/** A visitor's real distance from a fictional house means nothing. */
const DEMO_DISTANCE_M = 200;

function headline(view: IncidentView) {
  if (view.type === 'LONG_STAY') return `อยู่ใน${view.room}นานผิดปกติ`;
  if (view.type === 'VOICE_HELP') return `ขอความช่วยเหลือจาก${view.room}`;
  return `ล้มใน${view.room}`;
}

function statusLine(view: IncidentView): string {
  switch (view.status) {
    case 'ACCEPTED':
      return `${view.accepterName} รับงานแล้ว กำลังไป`;
    case 'ARRIVED':
      return `${view.accepterName} ถึงตัว${view.elder.title}แล้ว`;
    case 'RESOLVED':
      return 'ช่วยเหลือเสร็จแล้ว';
    case 'CANCELLED_SELF':
      return `${view.elder.title}ลุกได้เองแล้ว ยกเลิกงาน`;
    case 'CLOSED_BY_FAMILY':
      return 'ครอบครัวปิดเหตุการณ์นี้แล้ว';
    default:
      return 'กำลังหาคนไปช่วย';
  }
}

function EmsLink() {
  return (
    <a href="tel:1669" className="btn btn-lg btn-urgent">
      <Phone className="size-5" aria-hidden /> โทร 1669
    </a>
  );
}

/** What someone sees when the job is not theirs to take right now. */
function StatusView({ view }: { view: IncidentView }) {
  const family = view.viewerRole === 'FAMILY';
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      {view.open && <AutoRefresh />}
      <EmergencyHeader />
      <section className="glass p-5">
        <p className="text-sm font-semibold text-primary-text">
          {view.elder.name} · {clock(view.detectedAt)} น.
        </p>
        <h1 className="mt-1 text-2xl font-bold">{statusLine(view)}</h1>
        {!family && view.open && (
          <p className="mt-2 text-muted">
            สแตนด์บายไว้ก่อน ถ้าคนที่รับงานไปไม่ถึง ระบบจะแจ้งคุณอีกครั้ง
          </p>
        )}
        {family && view.status === 'ALERTING' && (
          <p className="mt-2 text-muted">
            แจ้ง {view.alertedCount} คนพร้อมกันแล้ว
          </p>
        )}
      </section>
      {view.open && view.escalated && <EmsLink />}
      {view.open && demoOpen() && (
        <ShareToLine
          incidentId={view.id}
          elderName={view.elder.name}
          demo={view.isDemoElder}
        />
      )}
      {family && view.open && <FamilyClose incidentId={view.id} />}
      <Link href="/liff/home" className="btn btn-soft">
        กลับหน้าแรก
      </Link>
    </main>
  );
}

export default async function AlertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await pageUser();
  const joining = await demoElderToJoin(user.id, id);
  if (joining) return <JoinDemo incidentId={id} elderName={joining} />;
  const view = await orNotFound(getIncidentView(user.id, id));

  if (view.isAccepter && view.status === 'ACCEPTED') {
    redirect(`/liff/incident/${id}/route`);
  }
  if (view.isAccepter && view.status === 'ARRIVED') {
    redirect(`/liff/incident/${id}/guide`);
  }
  if (view.viewerRole === 'FAMILY' || view.status !== 'ALERTING') {
    return <StatusView view={view} />;
  }

  const minutesAgo = minutesSince(view.detectedAt);
  const initial = (name: string) =>
    name.replace(/^(คุณ|ป้า|ลุง|อสม\.)/, '').replace(/^[เแโใไ]/, '')[0];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4 pb-0">
      <AutoRefresh />
      <EmergencyHeader
        right={
          <span className="chip bg-ink/5 text-muted">{user.displayName}</span>
        }
      />

      <section className="rounded-card border border-urgent bg-urgent-soft p-5 shadow-glass">
        <p className="flex items-center gap-2 text-sm font-bold text-urgent-text">
          <span className="size-2.5 animate-pulse rounded-full bg-urgent" />
          {view.type === 'FALL' ? 'ตรวจพบการล้ม · ต้องการคนช่วย' : 'ต้องการคนช่วย'}
        </p>
        <h1 className="mt-3 text-[28px] leading-tight font-bold">
          {view.elder.name}
          <br />
          {headline(view)}
        </h1>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-[20px] bg-white/85 p-3.5">
            <p className="text-sm text-muted">เวลาที่ล้ม</p>
            <p className="text-xl font-bold">{clock(view.detectedAt)} น.</p>
            <p className="text-sm text-urgent-text">
              {minutesAgo === 0 ? 'เมื่อสักครู่' : `${minutesAgo} นาทีที่แล้ว`}
            </p>
          </div>
          <DistanceStat
            lat={view.elder.lat}
            lng={view.elder.lng}
            fixedMetres={view.isDemoElder ? DEMO_DISTANCE_M : undefined}
          />
        </div>
        {view.noVoiceAnswer && (
          <p className="mt-2.5 flex items-center gap-2 rounded-[20px] bg-white/85 p-3.5 font-semibold">
            <MicOff className="size-5 text-urgent-text" aria-hidden />
            ยังไม่ตอบเสียงจากกล่อง
          </p>
        )}
      </section>

      <section className="glass divide-y divide-ink/8">
        <div className="flex gap-3 p-4">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden />
          <div>
            <p className="font-semibold">{view.elder.address}</p>
            {view.private?.notes && (
              <p className="text-sm text-muted">{view.private.notes}</p>
            )}
          </div>
        </div>
        {view.private?.keyHolder && (
          <div className="flex gap-3 p-4">
            <Key className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden />
            <p className="font-semibold">
              กุญแจสำรองอยู่กับ
              {view.private.keyHolder.isViewer
                ? 'คุณ'
                : view.private.keyHolder.name}
            </p>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 px-1">
        <div className="flex -space-x-2" aria-hidden>
          {view.alertedNames.slice(0, 3).map((name) => (
            <span
              key={name}
              className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-primary-soft text-sm font-bold text-primary-text"
            >
              {initial(name)}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted">
          แจ้ง {view.alertedCount} คนพร้อมกัน · ยังไม่มีใครรับงาน
        </p>
      </div>

      {demoOpen() && (
        <ShareToLine
          incidentId={id}
          elderName={view.elder.name}
          demo={view.isDemoElder}
        />
      )}

      {!view.private && (
        <p className="text-center text-sm text-muted">
          ข้อมูลสุขภาพของ{view.elder.title}จะแสดงหลังกดรับงาน
        </p>
      )}

      {/* The main action stays on screen however long the card above runs. */}
      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 bg-gradient-to-t from-page via-page to-transparent px-4 pt-6 pb-3">
        {view.escalated && <EmsLink />}
        <AlertActions incidentId={id} />
      </div>
    </main>
  );
}
