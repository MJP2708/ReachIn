'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';

type Result = 'OK' | 'MINOR_INJURY' | 'EMS_CALLED';

const RESULTS: Array<{ value: Result; label: string }> = [
  { value: 'OK', label: 'ลุกได้ ไม่บาดเจ็บ' },
  { value: 'MINOR_INJURY', label: 'บาดเจ็บเล็กน้อย' },
  { value: 'EMS_CALLED', label: 'โทร 1669 แล้ว' },
];

export function SummaryForm({
  incidentId,
  title,
  room,
  initialResult,
}: {
  incidentId: string;
  title: string;
  room: string;
  initialResult: Result;
}) {
  const router = useRouter();
  const checks = [
    `ให้${title}ดื่มน้ำ`,
    `เช็ดพื้น${room}ให้แห้ง`,
    'อยู่ดูอาการอย่างน้อย 30 นาที',
  ];
  const [result, setResult] = useState<Result>(initialResult);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const sent = await postJson(`/api/liff/incident/${incidentId}/summary`, {
      result,
      checklist,
      note,
    });
    if (sent.ok) {
      router.refresh();
      return;
    }
    setError(sent.error);
    setBusy(false);
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 pb-28">
        <fieldset className="glass p-4">
          <legend className="sr-only">ผลลัพธ์</legend>
          <p className="mb-2 font-bold">ผลลัพธ์</p>
          <div className="flex flex-col gap-2">
            {RESULTS.map((option) => (
              <label
                key={option.value}
                className={`flex min-h-12 items-center gap-3 rounded-2xl border p-3 font-semibold ${result === option.value ? 'border-primary bg-primary-soft' : 'border-ink/10 bg-white/85'}`}
              >
                <input
                  type="radio"
                  name="result"
                  checked={result === option.value}
                  onChange={() => setResult(option.value)}
                  className="size-5 accent-primary"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <section className="glass p-4">
          <p className="mb-2 font-bold">ก่อนกลับบ้าน</p>
          <div className="flex flex-col gap-2">
            {checks.map((item) => {
              const checked = checklist.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() =>
                    setChecklist((list) =>
                      checked ? list.filter((x) => x !== item) : [...list, item],
                    )
                  }
                  className="flex min-h-11 items-center gap-3 rounded-2xl text-left font-medium"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'border-transparent bg-primary-text text-white' : 'border-ink/25'}`}
                  >
                    {checked && <Check className="size-4" aria-hidden />}
                  </span>
                  {item}
                </button>
              );
            })}
          </div>
        </section>

        <label className="glass block p-4">
          <span className="mb-2 block font-bold">ข้อความถึงลูกหลาน</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder={`เล่าสั้น ๆ ว่า${title}เป็นอย่างไรบ้าง`}
            className="field"
          />
        </label>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-page via-page to-transparent p-4 pt-8">
        <div className="mx-auto max-w-md">
          {error && (
            <p role="alert" className="mb-2 text-center font-semibold text-urgent-text">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="btn btn-lg btn-primary"
          >
            ส่งสรุปให้ลูกหลาน
          </button>
        </div>
      </div>
    </>
  );
}
