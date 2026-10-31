import { SettingsForm } from '@/components/settings-form';
import { pageUser } from '@/lib/page-auth';

export default async function SettingsPage() {
  const user = await pageUser();
  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">ตั้งค่า</h1>
      <SettingsForm phone={user.phone} />
    </main>
  );
}
