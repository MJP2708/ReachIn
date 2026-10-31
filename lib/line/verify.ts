import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

const LINE_VERIFY_ENDPOINT = 'https://api.line.me/oauth2/v2.1/verify';

export type VerifiedLineIdentity = {
  /** The only value that counts as identity. */
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
};

/**
 * Verify a LIFF ID token with LINE.
 *
 * Sent to LINE's verify endpoint with our channel id, so LINE checks the
 * signature, the expiry and that the token was issued for this channel. The
 * browser's `liff.getProfile()` is never used: it is JSON anyone can fabricate.
 */
export async function verifyLineIdToken(
  idToken: string,
): Promise<VerifiedLineIdentity> {
  const channelId = env().LINE_LOGIN_CHANNEL_ID;
  if (!channelId) throw new Error('LINE_LOGIN_CHANNEL_ID is not configured');

  const res = await fetch(LINE_VERIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
    }).toString(),
  });
  if (!res.ok) {
    // LINE's body is not echoed: it can contain token fragments.
    throw new Error(`LINE rejected the id token (${res.status})`);
  }

  const claims = (await res.json()) as {
    sub?: string;
    aud?: string;
    exp?: number;
    name?: string;
    picture?: string;
  };
  if (!claims.sub) throw new Error('id token has no subject');
  if (claims.aud && claims.aud !== channelId) {
    throw new Error('id token was issued for a different channel');
  }
  if (claims.exp && claims.exp * 1000 < Date.now()) {
    throw new Error('id token has expired');
  }
  return {
    lineUserId: claims.sub,
    displayName: claims.name ?? '',
    pictureUrl: claims.picture,
  };
}

/**
 * Verify `x-line-signature` over the RAW body, before any parsing: the
 * signature covers the exact bytes, and re-serialised JSON will not match.
 */
export function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string = env().LINE_CHANNEL_SECRET,
): boolean {
  if (!signature || !channelSecret) return false;
  const expected = createHmac('sha256', channelSecret)
    .update(rawBody, 'utf8')
    .digest();
  const provided = Buffer.from(signature, 'base64');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
