'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';

export function FamilyClose({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setBusy(true);
    const result = await postJson(`/api/liff/incident/${incidentId}/close`);
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn btn-quiet"
      >
        ครอบครัวจัดการเองแล้ว ปิดเหตุการณ์นี้
      </button>
    );
  }
  return (
    <div className="glass p-4">
      <p className="font-semibold">ปิดเหตุการณ์นี้ใช่ไหม</p>
      <p className="mt-1 text-muted">คนช่วยทุกคนจะได้รับแจ้งว่าไม่ต้องไปแล้ว</p>
      {error && (
        <p role="alert" className="mt-2 text-urgent-text">
          {error}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="btn btn-soft"
        >
          ยังไม่ปิด
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={close}
          className="btn btn-urgent"
        >
          ปิดเหตุการณ์
        </button>
      </div>
    </div>
  );
}
