import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { requireFamily } from '@/lib/invites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ backupEnabled: z.boolean() });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(req);
  await requireFamily(user.id, id);
  const { backupEnabled } = await readBody(req, schema);
  await db().elder.update({ where: { id }, data: { backupEnabled } });
  return NextResponse.json({ ok: true, backupEnabled });
});
