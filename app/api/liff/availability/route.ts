import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  availability: z.boolean(),
  /** Hours from now, or null for no limit. */
  hours: z.number().positive().max(72).nullable().default(null),
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { availability, hours } = await readBody(req, schema);
  const availabilityUntil =
    availability && hours ? new Date(Date.now() + hours * 3_600_000) : null;
  await db().user.update({
    where: { id: user.id },
    data: { availability, availabilityUntil },
  });
  return NextResponse.json({ ok: true, availability, availabilityUntil });
});
