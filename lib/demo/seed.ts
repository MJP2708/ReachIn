import type { CircleRole, SummaryResult } from '@/lib/generated/prisma/client';
import type { Db } from '@/lib/db';
import { demoDeviceSecret, encryptDeviceSecret } from '@/lib/device/secret';

export const DEMO_USERS = [
  { id: 'demo-somchai', name: 'คุณสมชาย', phone: '0800000001' },
  { id: 'demo-daeng', name: 'ป้าแดง', phone: '0800000002' },
  { id: 'demo-daughter', name: 'ลูกสาว', phone: '0800000003' },
  { id: 'demo-nid', name: 'อสม.นิด', phone: '0800000004' },
  { id: 'demo-oi', name: 'อสม.อ้อย', phone: '0800000005' },
] as const;

export const SOMSRI = 'demo-somsri';
export const PRAYOON = 'demo-prayoon';

const ELDERS = [
  {
    id: SOMSRI,
    name: 'คุณยายสมศรี',
    nickname: 'สมศรี',
    title: 'คุณยาย',
    familyTerm: 'แม่',
    age: 78,
    sex: 'FEMALE',
    address: '23 หมู่ 4 ซอยวัดกลาง',
    lat: 13.7465,
    lng: 100.4825,
    phone: '0800000011',
    notes: 'บ้านสีฟ้า ประตูรั้วเหล็ก · กลอนห้องน้ำเปิดจากนอกได้',
  },
  {
    id: PRAYOON,
    name: 'คุณตาประยูร',
    nickname: 'ประยูร',
    title: 'คุณตา',
    familyTerm: 'พ่อ',
    age: 82,
    sex: 'MALE',
    address: '41 หมู่ 4 ซอยวัดกลาง',
    lat: 13.7482,
    lng: 100.4851,
    phone: '0800000012',
    notes: 'บ้านไม้สองชั้น ข้างศาลาหมู่บ้าน',
  },
] as const;

const CIRCLES: Array<{
  elderId: string;
  userId: string;
  role: CircleRole;
  hasKey?: boolean;
}> = [
  { elderId: SOMSRI, userId: 'demo-somchai', role: 'INNER' },
  { elderId: SOMSRI, userId: 'demo-daeng', role: 'INNER', hasKey: true },
  { elderId: SOMSRI, userId: 'demo-daughter', role: 'FAMILY' },
  { elderId: SOMSRI, userId: 'demo-nid', role: 'BACKUP' },
  { elderId: SOMSRI, userId: 'demo-oi', role: 'BACKUP' },
  { elderId: PRAYOON, userId: 'demo-daeng', role: 'INNER', hasKey: true },
  { elderId: PRAYOON, userId: 'demo-somchai', role: 'BACKUP' },
  { elderId: PRAYOON, userId: 'demo-daughter', role: 'FAMILY' },
  { elderId: PRAYOON, userId: 'demo-nid', role: 'BACKUP' },
];

const DEVICES = [
  { id: 'demo-device-somsri', serial: 'RI-DEMO-0001', elderId: SOMSRI },
  { id: 'demo-device-prayoon', serial: 'RI-DEMO-0002', elderId: PRAYOON },
] as const;

export const UNCLAIMED_DEVICE = {
  id: 'demo-device-new',
  serial: 'RI-DEMO-NEW',
  claimToken: 'demo-claim-token',
} as const;

const HISTORY: Array<{
  daysAgo: number;
  elderId: string;
  deviceId: string;
  accepterId: string | null;
  arriveMinutes?: number;
  result?: SummaryResult;
  note?: string;
}> = [
  { daysAgo: 6, elderId: SOMSRI, deviceId: 'demo-device-somsri', accepterId: 'demo-somchai', arriveMinutes: 4, result: 'OK', note: 'ลื่นตอนลุกจากส้วม ไม่เจ็บตรงไหน' },
  { daysAgo: 19, elderId: SOMSRI, deviceId: 'demo-device-somsri', accepterId: null },
  { daysAgo: 12, elderId: PRAYOON, deviceId: 'demo-device-prayoon', accepterId: 'demo-somchai', arriveMinutes: 6, result: 'EMS_CALLED', note: 'เจ็บสะโพก โทร 1669 แล้ว' },
  { daysAgo: 34, elderId: PRAYOON, deviceId: 'demo-device-prayoon', accepterId: 'demo-daeng', arriveMinutes: 5, result: 'OK', note: 'นั่งพักแล้วลุกได้' },
  { daysAgo: 58, elderId: SOMSRI, deviceId: 'demo-device-somsri', accepterId: 'demo-somchai', arriveMinutes: 5, result: 'MINOR_INJURY', note: 'ฟกช้ำที่แขนเล็กน้อย' },
  { daysAgo: 88, elderId: PRAYOON, deviceId: 'demo-device-prayoon', accepterId: 'demo-somchai', arriveMinutes: 7, result: 'OK', note: 'ลุกได้ ไม่บาดเจ็บ' },
  { daysAgo: 120, elderId: SOMSRI, deviceId: 'demo-device-somsri', accepterId: 'demo-daeng', arriveMinutes: 3, result: 'OK', note: 'ลุกได้ ไม่บาดเจ็บ' },
  { daysAgo: 150, elderId: SOMSRI, deviceId: 'demo-device-somsri', accepterId: 'demo-somchai', arriveMinutes: 6, result: 'OK', note: 'ลุกได้ ไม่บาดเจ็บ' },
];

const MINUTE = 60_000;
const DAY = 86_400_000;

/**
 * Create or restore the fictional demo data. Touches only demo rows: real
 * people who joined a demo elder's circle through an invite stay in it.
 */
export async function seedDemo(db: Db, now = new Date()) {
  const demoElderIds = ELDERS.map((elder) => elder.id);

  await db.incident.deleteMany({ where: { elderId: { in: demoElderIds } } });
  await db.outboundMessage.deleteMany({ where: { isDemo: true } });
  await db.invite.deleteMany({ where: { elderId: { in: demoElderIds } } });

  for (const { id, name, phone } of DEMO_USERS) {
    const data = {
      displayName: name,
      phone,
      isDemo: true,
      availability: true,
      availabilityUntil: null,
    };
    await db.user.upsert({
      where: { id },
      create: { id, lineUserId: `U-${id}`, ...data },
      update: data,
    });
  }

  for (const elder of ELDERS) {
    const data = { ...elder, isDemo: true, consentAt: new Date(now.getTime() - 90 * DAY) };
    await db.elder.upsert({ where: { id: elder.id }, create: data, update: data });
  }

  await db.condition.deleteMany({ where: { elderId: { in: demoElderIds } } });
  await db.medication.deleteMany({ where: { elderId: { in: demoElderIds } } });
  await db.condition.createMany({
    data: [
      { elderId: SOMSRI, label: 'ความดันโลหิตสูง' },
      { elderId: PRAYOON, label: 'เบาหวาน' },
    ],
  });
  await db.medication.createMany({
    data: [
      {
        elderId: SOMSRI,
        name: 'ยาละลายลิ่มเลือด',
        schedule: 'เย็น หลังอาหาร',
        warning: 'ถ้าหัวกระแทก ให้โทร 1669 ทันที',
      },
      { elderId: SOMSRI, name: 'ยาลดความดัน', schedule: 'เช้า' },
      { elderId: SOMSRI, name: 'แคลเซียม + วิตามินดี', schedule: 'เช้า' },
      { elderId: PRAYOON, name: 'ยาเบาหวาน', schedule: 'เช้า ก่อนอาหาร' },
    ],
  });

  for (const member of CIRCLES) {
    const data = { role: member.role, hasKey: member.hasKey ?? false, active: true };
    await db.circleMember.upsert({
      where: { elderId_userId: { elderId: member.elderId, userId: member.userId } },
      create: { elderId: member.elderId, userId: member.userId, ...data },
      update: data,
    });
  }

  for (const device of DEVICES) {
    await db.device.upsert({
      where: { id: device.id },
      create: {
        ...device,
        secretEnc: encryptDeviceSecret(demoDeviceSecret(device.serial)),
        lastHeartbeatAt: now,
      },
      update: { elderId: device.elderId, status: 'ONLINE', lastHeartbeatAt: now },
    });
  }
  await db.device.upsert({
    where: { id: UNCLAIMED_DEVICE.id },
    create: {
      ...UNCLAIMED_DEVICE,
      secretEnc: encryptDeviceSecret(demoDeviceSecret(UNCLAIMED_DEVICE.serial)),
    },
    update: { elderId: null, claimToken: UNCLAIMED_DEVICE.claimToken },
  });
  await db.deviceEvent.deleteMany({
    where: { deviceId: { in: [...DEVICES.map((d) => d.id), UNCLAIMED_DEVICE.id] } },
  });

  const helpersOf = (elderId: string) =>
    CIRCLES.filter((m) => m.elderId === elderId && m.role !== 'FAMILY').map(
      (m) => m.userId,
    );

  for (const past of HISTORY) {
    const detectedAt = new Date(now.getTime() - past.daysAgo * DAY);
    const resolved = past.accepterId !== null;
    const acceptedAt = resolved ? new Date(detectedAt.getTime() + MINUTE) : null;
    const arrivedAt = resolved
      ? new Date(detectedAt.getTime() + (past.arriveMinutes ?? 5) * MINUTE)
      : null;
    await db.incident.create({
      data: {
        elderId: past.elderId,
        deviceId: past.deviceId,
        type: 'FALL',
        status: resolved ? 'RESOLVED' : 'CANCELLED_SELF',
        detectedAt,
        alertingAt: detectedAt,
        acceptedById: past.accepterId,
        acceptedAt,
        arrivedAt,
        resolvedAt: arrivedAt ? new Date(arrivedAt.getTime() + 30 * MINUTE) : null,
        outcome: past.result,
        alertedUserIds: helpersOf(past.elderId),
        ...(resolved && {
          summary: {
            create: {
              result: past.result ?? 'OK',
              checklist: ['ให้ดื่มน้ำ', 'เช็ดพื้นห้องน้ำให้แห้ง'],
              note: past.note ?? '',
            },
          },
        }),
      },
    });
  }
}
