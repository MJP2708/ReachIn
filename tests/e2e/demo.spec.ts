import { expect, test } from '@playwright/test';

/** The whole stage demo with LINE off: FALL → accept → arrive → guide → summary. */
test('full demo runs from /demo with every message in the feed', async ({ page }) => {
  await page.goto('/demo');
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

  await page.getByText('ระวังพื้นเปียก เช็ดหรือวางผ้า').click();
  await expect(page.getByRole('checkbox', { name: 'ระวังพื้นเปียก เช็ดหรือวางผ้า' })).toBeChecked();
  await page.getByRole('button', { name: 'ปลอดภัยแล้ว ไปต่อ' }).click();
  await page.getByRole('button', { name: 'ไม่พบสัญญาณอันตราย ไปต่อ' }).click();
  await page.getByRole('button', { name: 'พร้อมลุก' }).click();
  await page.getByRole('button', { name: 'นั่งเก้าอี้ได้แล้ว ไปต่อ' }).click();

  await page.getByRole('button', { name: /ปลอดภัย$/ }).click();
  await expect(page.getByRole('heading', { name: 'ดูความปลอดภัยของคุณก่อน' })).toBeVisible();
  await page.getByRole('button', { name: /เฝ้าดู$/ }).click();

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
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('notice')).toHaveText('รีเซ็ตข้อมูลสาธิตแล้ว');
  await page.getByRole('combobox', { name: 'คนในวง' }).selectOption({ label: 'คุณสมชาย' });
  await page.getByTestId('act-as').click();
  await page.getByTestId('sim-FALL').click();
  await expect(page.getByTestId('feed')).toContainText('คุณยายสมศรีล้มในห้องน้ำ');
  await page.getByTestId('open-incident').click();
  await page.getByRole('button', { name: 'รับงาน ไปช่วยเลย' }).click();
  await page.getByRole('button', { name: 'ฉันถึงบ้านคุณยายแล้ว' }).click();
  await page.getByRole('button', { name: 'ปลอดภัยแล้ว ไปต่อ' }).click();
  await page.getByText('หัวกระแทก + กินยาละลายลิ่มเลือด').click();
  await page.getByRole('button', { name: 'พบสัญญาณอันตราย ดูวิธีโทร 1669' }).click();
  await expect(page.getByRole('heading', { name: 'อย่ายกคุณยาย โทร 1669' })).toBeVisible();
  await expect(page.getByTestId('ems-script')).toHaveText(
    'ผู้หญิง 78 ปี ล้มในห้องน้ำ ที่ 23 หมู่ 4 ซอยวัดกลาง กินยาละลายลิ่มเลือด อาการที่เห็น: หัวกระแทก + กินยาละลายลิ่มเลือด',
  );
  await expect(page.getByRole('link', { name: 'โทร 1669' })).toHaveAttribute('href', 'tel:1669');
});

test('one tap starts in the simulated LINE chat, and its buttons really work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'เริ่มสาธิต: คุณยายล้ม' }).click();

  const chat = page.getByTestId('line-chat');
  await expect(page.getByText('จำลองหน้าแชต LINE ของคุณสมชาย')).toBeVisible();
  await expect(chat).toContainText('คุณยายสมศรีล้มในห้องน้ำ');

  await chat.getByRole('button', { name: 'รับงาน ไปช่วยเลย' }).click();
  await expect(chat).toContainText('คุณรับงานแล้ว');
  await chat.getByRole('link', { name: 'เปิดคู่มือช่วยเหลือ' }).click();

  await expect(page.getByRole('heading', { name: 'กำลังไปหาคุณยาย' })).toBeVisible();
  await page.getByRole('button', { name: 'ลองกดจากที่ไกล 500 ม.' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'ห่างจากบ้าน 500 ม.' })).toBeVisible();
  await page.getByRole('button', { name: 'ฉันถึงบ้านคุณยายแล้ว' }).click();
  await expect(page.getByRole('heading', { name: 'ดูความปลอดภัยของคุณก่อน' })).toBeVisible();

  await page.getByRole('link', { name: 'แชต LINE' }).click();
  await page.getByRole('button', { name: 'ลูกสาว' }).click();
  await expect(chat).toContainText('แม่ล้มในห้องน้ำ กำลังหาคนไปช่วย');
  await expect(chat).toContainText('คุณสมชาย ถึงตัวแม่แล้ว');
  await expect(chat).not.toContainText('รับงาน ไปช่วยเลย');

  await page.getByRole('link', { name: 'แผงควบคุม' }).click();
  await expect(page.getByTestId('incident-status')).toContainText('ARRIVED');
});

test('a person can report a fall from the elder page', async ({ page }) => {
  await page.goto('/demo');
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('notice')).toHaveText('รีเซ็ตข้อมูลสาธิตแล้ว');
  await page.getByRole('combobox', { name: 'คนในวง' }).selectOption({ label: 'คุณสมชาย' });
  await page.getByTestId('act-as').click();
  await expect(page.getByText('ตอนนี้เล่นเป็น คุณสมชาย')).toBeVisible();
  await page.goto('/liff/elder/demo-somsri');
  await page.getByRole('button', { name: 'แจ้งเหตุ: คุณยายสมศรีล้ม' }).click();
  await page.getByRole('button', { name: 'แจ้งเหตุเลย' }).click();
  await expect(page.getByRole('heading', { name: /ล้มในบ้าน/ })).toBeVisible();
  await expect(page.getByText('ยังไม่ตอบเสียงจากกล่อง')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'รับงาน ไปช่วยเลย' })).toBeVisible();
});

test('phone buttons never dial in the demo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'เริ่มสาธิต: คุณยายล้ม' }).click();
  await expect(page.getByTestId('line-chat')).toContainText('คุณยายสมศรี');
  await page.goto('/liff/menu');
  await page.getByRole('link', { name: 'โทร 1669 ฉุกเฉิน' }).click();
  await expect(page.getByText('สาธิต: ของจริงปุ่มนี้จะโทรออก')).toBeVisible();
  await expect(page).toHaveURL(/liff\/menu/);
});

test('a page opened with no session goes to the landing page', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/liff/home');
  await expect(page.getByRole('button', { name: 'เริ่มสาธิต: คุณยายล้ม' })).toBeVisible();
});
