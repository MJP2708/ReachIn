import { randomBytes } from 'node:crypto';
import type { CircleRole } from '@/lib/generated/prisma/client';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http-error';

const INVITE_DAYS = 7;

export async function requireFamily(userId: string, elderId: string) {
  const member = await db().circleMember.findFirst({
    where: { userId, elderId, role: 'FAMILY', active: true },
  });
  if (!member) throw new HttpError(404, 'ไม่พบข้อมูลนี้');
}

export async function createInvite(
  userId: string,
  elderId: string,
  role: CircleRole,
) {
  await requireFamily(userId, elderId);
  const token = randomBytes(24).toString('base64url');
  await db().invite.create({
    data: {
      elderId,
      role,
      token,
      createdById: userId,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    },
  });
  return token;
}

/** The conditional update is what makes a token single-use under concurrency. */
export async function acceptInvite(token: string, userId: string) {
  return db().$transaction(async (tx) => {
    const now = new Date();
    const invite = await tx.invite.findUnique({ where: { token } });
    const claimed = await tx.invite.updateMany({
      where: { token, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (!invite || claimed.count !== 1) {
      throw new HttpError(410, 'ลิงก์เชิญนี้ใช้ไม่ได้แล้ว');
    }
    await tx.circleMember.upsert({
      where: { elderId_userId: { elderId: invite.elderId, userId } },
      create: { elderId: invite.elderId, userId, role: invite.role },
      update: { role: invite.role, active: true },
    });
    return invite.elderId;
  });
}
