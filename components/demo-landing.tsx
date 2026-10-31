import { Bell, BookOpenCheck, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Logo } from './logo';
import { StartDemo } from './start-demo';

const STEPS = [
  {
    icon: Bell,
    title: 'รู้ทันการล้ม',
    text: 'กล่องในห้องน้ำแจ้งทุกคนในวงพร้อมกัน ไม่ต้องกด ไม่ต้องสวม',
  },
  {
    icon: MapPin,
    title: 'คนถึงตัวไว',
    text: 'คนแรกที่กดรับงานได้งาน ระบบตรวจว่าไปถึงจริงด้วย GPS',
  },
  {
    icon: BookOpenCheck,
    title: 'ลูกหลานสบายใจ',
    text: 'คู่มือบอกทีละขั้นว่าต้องทำอะไร แล้วส่งสรุปให้ลูกหลาน',
  },
];

export function DemoLanding({ realLine }: { realLine: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-5 pb-0">
      <header className="flex justify-center pt-4">
        <Logo size={44} />
      </header>
      <section className="pt-2 text-center">
        <h1 className="text-[28px] leading-tight font-bold">
          รู้ทันการล้ม คนถึงตัวไว
          <br />
          ลูกหลานสบายใจ
        </h1>
        <p className="mt-2 text-muted">
          ลองเป็นคุณสมชาย เพื่อนบ้านของคุณยายสมศรี ที่เพิ่งล้มในห้องน้ำ ข้อความแจ้งเตือนจะเด้งเข้าแชต LINE จำลอง
        </p>
      </section>

      <ol className="flex flex-col gap-2.5">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="glass flex items-center gap-3 p-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
              <Icon className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-bold">{title}</span>
              <span className="block text-sm text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-1 bg-gradient-to-t from-page via-page to-transparent px-5 pt-6 pb-3">
        <StartDemo />
        {realLine && (
          <Link href="/liff/home" prefetch={false} className="btn btn-soft">
            เข้าด้วยบัญชี LINE ของฉัน
          </Link>
        )}
        <Link href="/demo" prefetch={false} className="btn btn-quiet">
          เปิดแผงควบคุมสาธิต
        </Link>
        <p className="text-center text-sm text-muted">
          เว็บสาธิต ข้อมูลทุกคนเป็นตัวอย่างสมมติ ไม่มีการโทรออก
        </p>
      </div>
    </main>
  );
}
