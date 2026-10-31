import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { requireDemo } from '@/lib/demo/guard';
import { getDemoFeed } from '@/lib/demo/feed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireDemo(req);
  return NextResponse.json(await getDemoFeed());
});
