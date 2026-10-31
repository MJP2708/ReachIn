import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  nickname: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(20),
  familyTerm: z.string().trim().min(1).max(20),
  age: z.number().int().min(40).max(120),
  sex: z.enum(['FEMALE', 'MALE']),
  address: z.string().trim().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(300).optional(),
  allergies: z.string().trim().max(200).optional(),
  conditions: z.array(z.string().trim().min(1).max(80)).max(20),
  medications: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        schedule: z.string().trim().min(1).max(80),
        warning: z.string().trim().max(120).optional(),
      }),
    )
    .max(30),
  consent: z.literal(true),
  claimToken: z.string().max(100).optional(),
});

/** The person registering becomes the first FAMILY member of the circle. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { conditions, medications, consent, claimToken, ...elder } =
    await readBody(req, schema);

  const elderId = await db().$transaction(async (tx) => {
    const created = await tx.elder.create({
      data: {
        ...elder,
        consentAt: consent ? new Date() : null,
        conditions: { create: conditions.map((label) => ({ label })) },
        medications: { create: medications },
        circle: { create: { userId: user.id, role: 'FAMILY' } },
      },
      select: { id: true },
    });
    if (claimToken) {
      const claimed = await tx.device.updateMany({
        where: { claimToken, elderId: null },
        data: { elderId: created.id, claimToken: null },
      });
      if (claimed.count !== 1) throw new HttpError(404, 'ไม่พบกล่องนี้ หรือมีคนลงทะเบียนแล้ว');
    }
    return created.id;
  });
  return NextResponse.json({ ok: true, elderId });
});
