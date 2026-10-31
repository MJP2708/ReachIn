import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { env } from '@/lib/env';

const key = () => Buffer.from(env().DEVICE_SECRET_KEY, 'base64');

/**
 * Device secrets are encrypted, not hashed. HMAC verification recomputes the
 * signature, so the server has to recover the raw key; a hash could never
 * verify anything. A database dump alone still reveals no device key.
 */
export function encryptDeviceSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), body]
    .map((part) =>
      typeof part === 'string' ? part : part.toString('base64url'),
    )
    .join('.');
}

export function decryptDeviceSecret(stored: string): string {
  const [version, iv, tag, body] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !body) {
    throw new Error('unrecognised device secret format');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(body, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function signDeviceBody(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function verifyDeviceSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signDeviceBody(rawBody, secret), 'hex');
  const provided = Buffer.from(signature, 'hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Stable per-serial secret for seeded boxes, so a demo reset keeps them. */
export function demoDeviceSecret(serial: string): string {
  return createHmac('sha256', key()).update(`demo:${serial}`).digest('hex');
}
