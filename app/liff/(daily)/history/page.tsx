import { HistoryView } from '@/components/history-view';
import { pageUser } from '@/lib/page-auth';
import { getHistory } from '@/lib/views';

export default async function HistoryPage() {
  const user = await pageUser();
  const items = await getHistory(user.id);
  return (
    <main>
      <h1 className="text-2xl font-bold">ประวัติการช่วยเหลือ</h1>
      <HistoryView items={items} />
    </main>
  );
}
