import { ElderTabs } from '@/components/elder-tabs';
import { orNotFound, pageUser } from '@/lib/page-auth';
import { getElderView } from '@/lib/views';

export default async function ElderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await pageUser();
  const elder = await orNotFound(getElderView(user.id, id));
  return (
    <main>
      <header className="glass p-4">
        <h1 className="text-xl font-bold">
          {elder.name} · {elder.age} ปี
        </h1>
        <p className="text-sm text-muted">{elder.address}</p>
      </header>
      <ElderTabs elder={elder} />
    </main>
  );
}
