'use client';

import { Siren } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';

export function ReportFall({
  elderId,
  elderName,
}: {
  elderId: string;
  elderName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function report() {
    setBusy(true);
    setError(null);
    const result = await postJson<{ incidentId: string }>(
      `/api/liff/elder/${elderId}/report`,
    );
    if (result.ok) {
      router.push(`/liff/incident/${result.incidentId}/alert`);
      return;
    }
    setError(result.error);
    setBusy(false);
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn btn-lg btn-urgent mt-3"
      >
        <Siren className="size-6" aria-hidden /> แจ้งเหตุ: {elderName}ล้ม
      </button>
    );
  }
  return (
    <section className="mt-3 rounded-card border border-urgent bg-urgent-soft p-4">
      <p className="font-bold">แจ้งทุกคนในวงว่า{elderName}ล้มใช่ไหม</p>
      <p className="mt-1 text-sm text-muted">
        ถ้าเจ็บหนักหรือไม่รู้สึกตัว ให้โทร 1669 ก่อน
      </p>
      {error && (
        <p role="alert" className="mt-2 font-semibold text-urgent-text">
          {error}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="btn btn-soft"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={report}
          className="btn btn-urgent"
        >
          แจ้งเหตุเลย
        </button>
      </div>
    </section>
  );
}
