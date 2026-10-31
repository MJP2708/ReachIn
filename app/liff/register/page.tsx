import { RegisterForm } from '@/components/register-form';
import { pageUser } from '@/lib/page-auth';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string }>;
}) {
  await pageUser();
  const { claim } = await searchParams;
  return (
    <main className="mx-auto min-h-dvh max-w-md p-4">
      <h1 className="text-2xl font-bold">ลงทะเบียนผู้สูงอายุ</h1>
      <p className="mb-4 text-muted">ข้อมูลนี้ลูกหลานเป็นคนกรอก</p>
      <RegisterForm claimToken={claim} />
    </main>
  );
}
