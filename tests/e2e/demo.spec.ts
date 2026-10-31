import { expect, test } from '@playwright/test';

/** The whole stage demo with LINE off: FALL → accept → arrive → guide → summary. */
test('full demo runs from /demo with every message in the feed', async ({ page }) => {
  await page.goto('/demo');
  await page.getByLabel('รหัสสาธิต').fill(process.env.DEMO_SECRET ?? 'test-demo-secret');
  await page.getByRole('button', { name: 'เข้าสู่โหมดสาธิต' }).click();
  await expect(page.getByTestId('sim-FALL')).toBeVisible();

  await page.getByTestId('reset').click();
  await expect(page.getByTestId('notice')).toHaveText('รีเซ็ตข้อมูลสาธิตแล้ว');

  await page.getByRole('combobox', { name: 'คนในวง' }).selectOption({ label: 'คุณสมชาย' });
  await page.getByTestId('act-as').click();
  await expect(page.getByText('ตอนนี้เล่นเป็น คุณสมชาย')).toBeVisible();

  await page.getByTestId('sim-FALL').click();
  const feed = page.getByTestId('feed');
  await expect(feed).toContainText('คุณยายสมศรีล้มในห้องน้ำ');
  await expect(feed).toContainText('แม่ล้มในห้องน้ำ กำลังหาคนไปช่วย');

  await page.getByTestId('open-incident').click();
  await expect(page.getByRole('button', { name: 'รับงาน ไปช่วยเลย' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'เมนูหลัก' })).toHaveCount(0);

  await page.getByRole('button', { name: 'รับงาน ไปช่วยเลย' }).click();
  await expect(page.getByRole('heading', { name: 'กำลังไปหาคุณยาย' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'เปิดเส้นทางใน Google Maps' })).toHaveAttribute(
    'href',
    /google\.com\/maps\/dir\/\?api=1&destination=13\.7465,100\.4825&travelmode=walking/,
  );

  await page.getByRole('button', { name: 'ฉันถึงบ้านคุณยายแล้ว' }).click();
  await expect(page.getByRole('heading', { name: 'ดูความปลอดภัยของคุณก่อน' })).toBeVisible();

  await page.getByRole('checkbox', { name: 'ระวังพื้นเปียก เช็ดหรือวางผ้า' }).click();
  await page.getByRole('button', { name: 'ปลอดภัยแล้ว ไปต่อ' }).click();
  await page.getByRole('button', { name: 'ไม่พบสัญญาณอันตราย ไปต่อ' }).click();
  await page.getByRole('button', { name: 'พร้อมลุก' }).click();
  await page.getByRole('button', { name: 'นั่งเก้าอี้ได้แล้ว ไปต่อ' }).click();

  await page.getByRole('button', { name: /^1/ }).click();
  await expect(page.getByRole('heading', { name: 'ดูความปลอดภัยของคุณก่อน' })).toBeVisible();
  await page.getByRole('button', { name: /^5/ }).click();

  await page.getByRole('link', { name: 'เฝ้าดูครบแล้ว ไปสรุป' }).click();
  await page.getByLabel('ลุกได้ ไม่บาดเจ็บ').check();
  await page.getByLabel('ข้อความถึงลูกหลาน').fill('นั่งพักอยู่ ไม่เจ็บตรงไหน');
  await page.getByRole('button', { name: 'ส่งสรุปให้ลูกหลาน' }).click();
  await expect(page.getByText('ลูกหลานได้รับสรุปแล้ว')).toBeVisible();

  await page.goto('/demo');
  await expect(page.getByTestId('incident-status')).toContainText('RESOLVED');
  await expect(feed).toContainText('คุณสมชาย กำลังไป');
  await expect(feed).toContainText('คุณสมชาย รับงานแล้ว สแตนด์บายไว้ก่อน');
  await expect(feed).toContainText('ถึงแล้ว ขอบคุณที่สแตนด์บาย');
  await expect(feed).toContainText('คุณสมชาย ถึงตัวแม่แล้ว');
  await expect(feed).toContainText('นั่งพักอยู่ ไม่เจ็บตรงไหน');
});

test('a red flag leads to the EMS screen with the auto script', async ({ page }) => {
  await page.goto('/demo');
  await page.getByLabel('รหัสสาธิต').fill(process.env.DEMO_SECRET ?? 'test-demo-secret');
  await page.getByRole('button', { name: 'เข้าสู่โหมดสาธิต' }).click();
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('notice')).toHaveText('รีเซ็ตข้อมูลสาธิตแล้ว');
  await page.getByRole('combobox', { name: 'คนในวง' }).selectOption({ label: 'คุณสมชาย' });
  await page.getByTestId('act-as').click();
  await page.getByTestId('sim-FALL').click();
  await page.getByTestId('open-incident').click();
  await page.getByRole('button', { name: 'รับงาน ไปช่วยเลย' }).click();
  await page.getByRole('button', { name: 'ฉันถึงบ้านคุณยายแล้ว' }).click();
  await page.getByRole('button', { name: 'ปลอดภัยแล้ว ไปต่อ' }).click();
  await page.getByRole('checkbox', { name: 'หัวกระแทก + กินยาละลายลิ่มเลือด' }).click();
  await page.getByRole('button', { name: 'พบสัญญาณอันตราย ดูวิธีโทร 1669' }).click();
  await expect(page.getByRole('heading', { name: 'อย่ายกคุณยาย โทร 1669' })).toBeVisible();
  await expect(page.getByTestId('ems-script')).toHaveText(
    'ผู้หญิง 78 ปี ล้มในห้องน้ำ ที่ 23 หมู่ 4 ซอยวัดกลาง กินยาละลายลิ่มเลือด อาการที่เห็น: หัวกระแทก + กินยาละลายลิ่มเลือด',
  );
  await expect(page.getByRole('link', { name: 'โทร 1669' })).toHaveAttribute('href', 'tel:1669');
});
