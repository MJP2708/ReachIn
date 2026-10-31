'use client';

import { useState } from 'react';
import { postJson } from '@/lib/client-api';

export function SettingsForm({ phone }: { phone: string | null }) {
  const [value, setValue] = useState(phone ?? '');
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    const result = await postJson('/api/liff/settings', {
      phone: value.trim() || null,
    });
    setMessage(result.ok ? 'บันทึกแล้ว' : 'เบอร์โทรไม่ถูกต้อง');
  }

  return (
    <section className="glass p-4">
      <label className="block">
        <span className="mb-1 block font-bold">เบอร์โทรของฉัน</span>
        <input
          type="tel"
          inputMode="tel"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="field"
        />
      </label>
      <p className="mt-1 text-sm text-muted">
        คนที่รับงานจะโทรหาคุณได้เมื่อคุณเป็นคนถือกุญแจ
      </p>
      <button type="button" onClick={save} className="btn btn-primary mt-3">
        บันทึก
      </button>
      {message && (
        <output className="block mt-2 text-center text-muted">
          {message}
        </output>
      )}
    </section>
  );
}
