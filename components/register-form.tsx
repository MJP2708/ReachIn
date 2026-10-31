'use client';

import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { postJson } from '@/lib/client-api';
import type { LatLng } from '@/lib/geo';
import { CircleManager } from './circle-manager';
import { LocationPicker } from './location-picker';

type Medication = { name: string; schedule: string; warning: string };

const BLANK_MEDICATION: Medication = { name: '', schedule: '', warning: '' };

export function RegisterForm({ claimToken }: { claimToken?: string }) {
  const [sex, setSex] = useState<'FEMALE' | 'MALE'>('FEMALE');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elderId, setElderId] = useState<string | null>(null);

  const setMedication = (index: number, patch: Partial<Medication>) =>
    setMedications((list) =>
      list.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) {
      setError('เลือกตำแหน่งบ้านบนแผนที่ก่อน');
      return;
    }
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    setBusy(true);
    setError(null);
    const female = sex === 'FEMALE';
    const result = await postJson<{ elderId: string }>('/api/liff/register', {
      name: text('name'),
      nickname: text('nickname') || text('name'),
      title: female ? 'คุณยาย' : 'คุณตา',
      familyTerm: female ? 'แม่' : 'พ่อ',
      age: Number(text('age')),
      sex,
      address: text('address'),
      ...location,
      phone: text('phone') || undefined,
      notes: text('notes') || undefined,
      allergies: text('allergies') || undefined,
      conditions: text('conditions')
        .split(/[,\n]/)
        .map((label) => label.trim())
        .filter(Boolean),
      medications: medications
        .filter((medication) => medication.name && medication.schedule)
        .map((medication) => ({
          ...medication,
          warning: medication.warning || undefined,
        })),
      consent,
      claimToken,
    });
    setBusy(false);
    if (result.ok) setElderId(result.elderId);
    else setError(result.error);
  }

  if (elderId) {
    return (
      <div className="flex flex-col gap-3">
        <p className="glass p-4 font-semibold">
          ลงทะเบียนแล้ว ชวนคนในวงเข้ามาได้เลย
        </p>
        <CircleManager elderId={elderId} backupEnabled />
        <Link href={`/liff/elder/${elderId}`} className="btn btn-primary">
          ไปหน้าผู้สูงอายุ
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <section className="glass flex flex-col gap-3 p-4">
        <h2 className="font-bold">ข้อมูลผู้สูงอายุ</h2>
        <label>
          ชื่อ
          <input name="name" required maxLength={80} className="field mt-1" />
        </label>
        <label>
          ชื่อเล่น
          <input name="nickname" maxLength={40} className="field mt-1" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            อายุ
            <input name="age" type="number" required min={40} max={120} className="field mt-1" />
          </label>
          <label>
            เพศ
            <select
              value={sex}
              onChange={(event) => setSex(event.target.value as 'FEMALE' | 'MALE')}
              className="field mt-1"
            >
              <option value="FEMALE">หญิง</option>
              <option value="MALE">ชาย</option>
            </select>
          </label>
        </div>
        <label>
          เบอร์โทรผู้สูงอายุ
          <input name="phone" type="tel" maxLength={20} className="field mt-1" />
        </label>
      </section>

      <section className="glass flex flex-col gap-3 p-4">
        <h2 className="font-bold">บ้าน</h2>
        <label>
          ที่อยู่
          <input name="address" required maxLength={200} className="field mt-1" />
        </label>
        <label>
          จุดสังเกต การเข้าบ้าน
          <input name="notes" maxLength={300} className="field mt-1" />
        </label>
        <LocationPicker value={location} onChange={setLocation} />
      </section>

      <section className="glass flex flex-col gap-3 p-4">
        <h2 className="font-bold">สุขภาพ</h2>
        <label>
          โรคประจำตัว (คั่นด้วยจุลภาค)
          <input name="conditions" className="field mt-1" />
        </label>
        <label>
          แพ้ยา
          <input name="allergies" maxLength={200} className="field mt-1" />
        </label>
        <p className="text-sm text-muted">
          บันทึกเฉพาะประเภทยา ไม่ต้องใส่ขนาดยา
        </p>
        {medications.map((medication, index) => (
          <div key={index} className="rounded-2xl bg-white/70 p-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-semibold">ยา {index + 1}</p>
              <button
                type="button"
                aria-label={`ลบยา ${index + 1}`}
                onClick={() =>
                  setMedications((list) => list.filter((_, i) => i !== index))
                }
                className="flex size-11 items-center justify-center text-muted"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <input
                aria-label="ประเภทยา"
                placeholder="ประเภทยา เช่น ยาลดความดัน"
                value={medication.name}
                onChange={(event) => setMedication(index, { name: event.target.value })}
                className="field"
              />
              <input
                aria-label="เวลากินยา"
                placeholder="เวลากิน เช่น เช้า หลังอาหาร"
                value={medication.schedule}
                onChange={(event) => setMedication(index, { schedule: event.target.value })}
                className="field"
              />
              <input
                aria-label="คำเตือน"
                placeholder="คำเตือน (ถ้ามี)"
                value={medication.warning}
                onChange={(event) => setMedication(index, { warning: event.target.value })}
                className="field"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setMedications((list) => [...list, BLANK_MEDICATION])}
          className="btn btn-soft"
        >
          <Plus className="size-5" aria-hidden /> เพิ่มยา
        </button>
      </section>

      <label className="glass flex items-start gap-3 p-4 font-semibold">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-5 shrink-0 accent-primary"
        />
        ผู้สูงอายุรับทราบและยินยอมให้คนในวงได้รับแจ้งเตือนและเห็นข้อมูลนี้
      </label>

      {error && (
        <p role="alert" className="text-center font-semibold text-urgent-text">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn btn-lg btn-primary">
        ลงทะเบียน
      </button>
    </form>
  );
}
