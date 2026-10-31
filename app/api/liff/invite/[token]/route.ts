import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { acceptInvite } from '@/lib/invites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route<{ token: string }>(async (req, { token }) => {
  const user = await requireUser(req);
  const elderId = await acceptInvite(token, user.id);
  return NextResponse.json({ ok: true, elderId });
});
