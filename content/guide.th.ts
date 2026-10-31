// ต้องให้นักกายภาพหรือพยาบาลตรวจก่อนใช้จริง

/** `{title}` becomes คุณยาย or คุณตา when rendered. */
export const GUIDE_DISCLAIMER =
  'แอปนี้ให้คำแนะนำการช่วยเหลือเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์';

export const STEPS = [
  { number: 1, label: 'ปลอดภัย' },
  { number: 2, label: 'ประเมิน' },
  { number: 3, label: 'ตัดสินใจ' },
  { number: 4, label: 'พยุงลุก' },
  { number: 5, label: 'เฝ้าดู' },
] as const;

export const STEP_1 = {
  heading: 'ดูความปลอดภัยของคุณก่อน',
  why: 'ถ้าคุณลื่นล้มอีกคน จะไม่มีใครช่วย{title}ได้',
  checks: ['ระวังพื้นเปียก เช็ดหรือวางผ้า', 'ปิดน้ำที่ยังไหลอยู่', 'เปิดไฟให้สว่าง'],
  next: 'ปลอดภัยแล้ว ไปต่อ',
};

export const STEP_2 = {
  heading: 'ถาม{title}ก่อน ยังไม่ต้องยก',
  ask: 'เจ็บตรงไหนคะ หัวกระแทกไหม ขยับขาได้ไหม',
  flagsLabel: 'แตะสัญญาณอันตรายที่พบ',
  flags: [
    'เจ็บสะโพกมาก ขยับขาไม่ได้',
    'ขาดูสั้นลง หรือบิดผิดรูป',
    'หัวกระแทก ซึม หรือสับสน',
    'หัวกระแทก + กินยาละลายลิ่มเลือด',
  ],
  noFlags: 'ไม่พบสัญญาณอันตราย ไปต่อ',
  hasFlags: 'พบสัญญาณอันตราย ดูวิธีโทร 1669',
};

export const STEP_3 = {
  heading: 'ถาม{title}ว่าพร้อมไหม',
  ask: '{title}รู้สึกพร้อมจะลุกขึ้นนั่งเก้าอี้ไหมคะ',
  ready: 'พร้อมลุก',
  notReady: 'ยังไม่พร้อม',
  rest: 'ให้นอนพักต่อ ห่มผ้าให้อุ่น แล้วถามใหม่อีกครั้ง',
};

export const STEP_4 = {
  heading: 'พยุงลุกทีละขั้น',
  moves: [
    'พลิกตัวตะแคง',
    'ยันตัวขึ้นคุกเข่า',
    'จับเก้าอี้ที่มั่นคง',
    'ค่อย ๆ ลุกนั่งเก้าอี้',
  ],
  stop: 'หยุดทันทีถ้าเจ็บมากขึ้น',
  cannot: 'ลุกไม่ได้ · 1669',
  next: 'นั่งเก้าอี้ได้แล้ว ไปต่อ',
};

export const STEP_5 = {
  heading: 'เฝ้าดู 30 นาที',
  checks: ['จิบน้ำ', 'เช็ดพื้นให้แห้ง', 'ถามอาการทุก 10 นาที'],
  warn: 'โทร 1669 ถ้าปวดหัวมากขึ้น อาเจียน ง่วงซึม หรือพูดไม่ชัด',
  next: 'เฝ้าดูครบแล้ว ไปสรุป',
};

export const EMS = {
  heading: 'อย่ายก{title} โทร 1669',
  scriptLabel: 'อ่านข้อความนี้ให้เจ้าหน้าที่',
  call: 'โทร 1669',
  waitingLabel: 'ระหว่างรอรถพยาบาล',
  waiting: [
    'อยู่กับ{title} พูดคุยให้ใจเย็น',
    'ห่มผ้าให้อุ่น ไม่ต้องขยับตัว',
    'ยังไม่ให้กินหรือดื่มอะไร',
    'เปิดประตูบ้าน ให้คนไปรอรับรถ',
  ],
  back: 'กลับไปดูคู่มือ',
  finish: 'รถพยาบาลมาแล้ว ไปสรุป',
};

export const fillTitle = (text: string, title: string) =>
  text.replaceAll('{title}', title);

/** The script a helper reads to 1669, assembled from what is on file. */
export function buildEmsScript(input: {
  sex: 'FEMALE' | 'MALE';
  age: number;
  room: string;
  address: string;
  keyMedications: string[];
  flags: string[];
}): string {
  const sex = input.sex === 'FEMALE' ? 'ผู้หญิง' : 'ผู้ชาย';
  const medications = input.keyMedications.length
    ? `กิน${input.keyMedications.join(' ')} `
    : '';
  const flags = input.flags.length ? input.flags.join(', ') : 'ไม่ระบุ';
  return `${sex} ${input.age} ปี ล้มใน${input.room} ที่ ${input.address} ${medications}อาการที่เห็น: ${flags}`;
}
