import Link from 'next/link';
import { pageUser } from '@/lib/page-auth';
import { clock, shortDate } from '@/lib/time';
import { getNotifications } from '@/lib/views';

export default async function NotificationsPage() {
  const user = await pageUser();
  const items = await getNotifications(user.id);
  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">แจ้งเตือน</h1>
      <ul className="flex flex-col gap-2.5">
        {items.length === 0 && (
          <li className="glass p-5 text-center text-muted">ยังไม่มีการแจ้งเตือน</li>
        )}
        {items.map((item) => {
          const body = (
            <>
              <p className="text-sm text-muted">
                {shortDate(item.createdAt)} · {clock(item.createdAt)} น.
              </p>
              <p className="font-medium">{item.text}</p>
            </>
          );
          return (
            <li key={item.id}>
              {item.incidentId ? (
                <Link href={`/liff/incident/${item.incidentId}/alert`} className="glass block p-4">
                  {body}
                </Link>
              ) : (
                <div className="glass p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
