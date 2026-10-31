import { notFound } from 'next/navigation';
import { LineChat } from '@/components/line-chat';
import { db } from '@/lib/db';
import { demoOpen } from '@/lib/demo/guard';
import { pageUser } from '@/lib/page-auth';

export default async function LineChatPage() {
  if (!demoOpen()) notFound();
  const user = await pageUser();
  const people = await db().user.findMany({
    where: { isDemo: true },
    select: { id: true, displayName: true },
    orderBy: { id: 'desc' },
  });
  return (
    <LineChat
      people={people}
      currentId={user.id}
      currentName={user.displayName}
    />
  );
}
