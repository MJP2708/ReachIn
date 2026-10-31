import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { STEP_2, buildEmsScript, fillTitle } from '@/content/guide.th';
import {
  decryptDeviceSecret,
  encryptDeviceSecret,
  signDeviceBody,
  verifyDeviceSignature,
} from '@/lib/device/secret';
import { isFreshTimestamp } from '@/lib/device/events';
import { haversineMetres, pointNorthOf } from '@/lib/geo';
import { monthBuckets } from '@/lib/history';
import { verifyLineSignature } from '@/lib/line/verify';
import { canSeePrivate } from '@/lib/privacy';
import { isAvailable } from '@/lib/user';

describe('geo', () => {
  const home = { lat: 13.7465, lng: 100.4825 };

  it('measures known distances', () => {
    expect(haversineMetres(home, home)).toBe(0);
    expect(haversineMetres(home, pointNorthOf(home, 50))).toBeCloseTo(50, 0);
    expect(haversineMetres(home, pointNorthOf(home, 500))).toBeCloseTo(500, 0);
    // One degree of latitude is about 111 km.
    expect(haversineMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });
});

describe('device secret', () => {
  it('round-trips through encryption without storing the plaintext', () => {
    const stored = encryptDeviceSecret('s3cret');
    expect(stored).not.toContain('s3cret');
    expect(decryptDeviceSecret(stored)).toBe('s3cret');
  });

  it('refuses a tampered ciphertext', () => {
    const parts = encryptDeviceSecret('s3cret').split('.');
    parts[3] = Buffer.from('xxxxxx').toString('base64url');
    expect(() => decryptDeviceSecret(parts.join('.'))).toThrow();
  });

  it('verifies a signature and rejects anything else', () => {
    const signature = signDeviceBody('{"a":1}', 'key');
    expect(verifyDeviceSignature('{"a":1}', signature, 'key')).toBe(true);
    expect(verifyDeviceSignature('{"a":2}', signature, 'key')).toBe(false);
    expect(verifyDeviceSignature('{"a":1}', signature, 'other')).toBe(false);
    expect(verifyDeviceSignature('{"a":1}', 'abc', 'key')).toBe(false);
    expect(verifyDeviceSignature('{"a":1}', null, 'key')).toBe(false);
  });

  it('accepts a timestamp within five minutes either way', () => {
    const now = new Date('2026-10-31T12:00:00Z');
    const seconds = now.getTime() / 1000;
    expect(isFreshTimestamp(seconds, now)).toBe(true);
    expect(isFreshTimestamp(seconds - 299, now)).toBe(true);
    expect(isFreshTimestamp(seconds - 301, now)).toBe(false);
    expect(isFreshTimestamp(seconds + 301, now)).toBe(false);
  });
});

describe('LINE signature', () => {
  const body = '{"events":[]}';
  const good = createHmac('sha256', 'secret').update(body).digest('base64');

  it('accepts the right signature only', () => {
    expect(verifyLineSignature(body, good, 'secret')).toBe(true);
    expect(verifyLineSignature(body, good, 'other')).toBe(false);
    expect(verifyLineSignature(`${body} `, good, 'secret')).toBe(false);
    expect(verifyLineSignature(body, null, 'secret')).toBe(false);
    expect(verifyLineSignature(body, 'bm90LWl0', 'secret')).toBe(false);
  });
});

describe('privacy', () => {
  it.each([
    ['FAMILY', false, true],
    ['INNER', false, true],
    ['BACKUP', false, false],
    ['BACKUP', true, true],
  ] as const)('%s, accepter=%s → %s', (role, isOpenIncidentAccepter, expected) => {
    expect(canSeePrivate({ role, isOpenIncidentAccepter })).toBe(expected);
  });
});

describe('availability', () => {
  const now = new Date('2026-10-31T12:00:00Z');
  it('lapses on its own', () => {
    expect(isAvailable({ availability: true, availabilityUntil: null }, now)).toBe(true);
    expect(isAvailable({ availability: false, availabilityUntil: null }, now)).toBe(false);
    expect(isAvailable({ availability: true, availabilityUntil: new Date('2026-10-31T13:00:00Z') }, now)).toBe(true);
    expect(isAvailable({ availability: true, availabilityUntil: new Date('2026-10-31T11:00:00Z') }, now)).toBe(false);
  });
});

describe('guide', () => {
  it('builds the 1669 script from what is on file', () => {
    expect(
      buildEmsScript({
        sex: 'FEMALE',
        age: 78,
        room: 'ห้องน้ำ',
        address: '23 หมู่ 4 ซอยวัดกลาง',
        keyMedications: ['ยาละลายลิ่มเลือด'],
        flags: [STEP_2.flags[3]!],
      }),
    ).toBe(
      'ผู้หญิง 78 ปี ล้มในห้องน้ำ ที่ 23 หมู่ 4 ซอยวัดกลาง กินยาละลายลิ่มเลือด อาการที่เห็น: หัวกระแทก + กินยาละลายลิ่มเลือด',
    );
  });

  it('addresses the right person', () => {
    expect(fillTitle('อย่ายก{title} โทร 1669', 'คุณตา')).toBe('อย่ายกคุณตา โทร 1669');
  });
});

describe('history chart', () => {
  it('keeps six months, including empty ones', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    const buckets = monthBuckets(
      [{ detectedAt: '2026-10-02T00:00:00Z' }, { detectedAt: '2026-10-09T00:00:00Z' }, { detectedAt: '2026-05-15T00:00:00Z' }, { detectedAt: '2025-01-01T00:00:00Z' }],
      now,
    );
    expect(buckets.map((bucket) => bucket.count)).toEqual([1, 0, 0, 0, 0, 2]);
    expect(buckets.at(-1)!.label).toBe('ต.ค.');
  });
});
