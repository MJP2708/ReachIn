import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { createInvite } from '@/lib/invites';
import { liffUrl } from '@/lib/line/urls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ role: z.enum(['FAMILY', 'INNER', 'BACKUP']) });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  const { role } = await readBody(req, schema);
  const token = await createInvite(user.id, id, role);
  return NextResponse.json({ ok: true, url: liffUrl(`/invite/${token}`) });
});
