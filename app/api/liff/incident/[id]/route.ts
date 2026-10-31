import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { getIncidentView } from '@/lib/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  return NextResponse.json(await getIncidentView(user.id, id));
});
