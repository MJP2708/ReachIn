import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ElderCard } from '@/components/elder-card';
import { pageUser } from '@/lib/page-auth';
import { getHome } from '@/lib/views';

export default async function EldersPage() {
  const user = await pageUser();
  const { elders } = await getHome(user);
  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">ผู้สูงอายุที่ฉันดูแล</h1>
      <div className="flex flex-col gap-2.5">
        {elders.map((elder) => (
          <ElderCard key={elder.id} elder={elder} />
        ))}
      </div>
      {elders.length === 0 && (
        <p className="glass p-5 text-center text-muted">ยังไม่ได้อยู่ในวงของใคร</p>
      )}
      <Link href="/liff/register" className="btn btn-soft mt-4">
        <Plus className="size-5" aria-hidden /> ลงทะเบียนผู้สูงอายุ
      </Link>
    </main>
  );
}
