import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { joinDemoIncident } from '@/lib/demo/join';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  await joinDemoIncident(user.id, id);
  return NextResponse.json({ ok: true });
});
