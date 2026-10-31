import { InviteAccept } from '@/components/invite-accept';
import { Logo } from '@/components/logo';
import { db } from '@/lib/db';
import { pageUser } from '@/lib/page-auth';
import { ROLE_LABEL } from '@/lib/views';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await pageUser();
  const invite = await db().invite.findUnique({
    where: { token },
    select: {
      role: true,
      usedAt: true,
      expiresAt: true,
      elder: { select: { name: true } },
    },
  });
  const valid =
    invite && !invite.usedAt && invite.expiresAt.getTime() > Date.now();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <div className="flex justify-center">
        <Logo />
      </div>
      <section className="glass p-6 text-center">
        {valid ? (
          <>
            <h1 className="text-xl font-bold">
              ลูกหลานชวนคุณเข้าวงคนช่วยของ{invite.elder.name}
            </h1>
            <p className="mt-2 text-muted">
              บทบาท: {ROLE_LABEL[invite.role]} เมื่อ{invite.elder.name}
              ต้องการความช่วยเหลือ คุณจะได้รับแจ้งเตือนทาง LINE
            </p>
            <InviteAccept token={token} />
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">ลิงก์เชิญนี้ใช้ไม่ได้แล้ว</h1>
            <p className="mt-2 text-muted">ขอลิงก์ใหม่จากลูกหลานได้เลย</p>
          </>
        )}
      </section>
    </main>
  );
}
