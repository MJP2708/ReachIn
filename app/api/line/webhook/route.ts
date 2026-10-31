import type { webhook } from '@line/bot-sdk';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyLineSignature } from '@/lib/line/verify';
import { handleWebhookEvent } from '@/lib/line/webhook';
import { afterResponse } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // The signature covers the exact bytes LINE sent, so read them first.
  const raw = await req.text();
  const signature = req.headers.get('x-line-signature');

  if (!verifyLineSignature(raw, signature)) {
    console.warn(
      '[webhook][signature-rejected]',
      JSON.stringify({ hasSignature: Boolean(signature), bytes: raw.length }),
    );
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let events: webhook.Event[] = [];
  try {
    events = (JSON.parse(raw) as webhook.CallbackRequest).events;
  } catch {
    // Still a 200: retrying would not fix bad JSON.
    console.error('[webhook] body was not JSON');
  }

  afterResponse(async () => {
    for (const event of events) {
      await handleWebhookEvent(event).catch((error: unknown) => {
        console.error('[webhook]', event.type, (error as Error).name);
      });
    }
  });

  return NextResponse.json({ ok: true });
}
