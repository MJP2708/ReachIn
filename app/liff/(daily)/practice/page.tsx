import { GuideFlow } from '@/components/guide-flow';
import { pageUser } from '@/lib/page-auth';

export default async function PracticePage() {
  await pageUser();
  return (
    <main className="flex flex-col gap-3">
      <header className="px-1">
        <h1 className="text-2xl font-bold">ซ้อมคู่มือช่วยคนล้ม</h1>
        <p className="text-muted">โหมดซ้อม ไม่มีการแจ้งเตือนใคร</p>
      </header>
      <GuideFlow
        doneHref="/liff/home"
        elder={{
          title: 'คุณยาย',
          sex: 'FEMALE',
          age: 78,
          address: 'ที่อยู่ตัวอย่าง',
          room: 'ห้องน้ำ',
          keyMedications: [],
        }}
      />
    </main>
  );
}
