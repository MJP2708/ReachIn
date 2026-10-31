'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';
import { EmergencyHeader } from './emergency-header';

export function JoinDemo({
  incidentId,
  elderName,
}: {
  incidentId: string;
  elderName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    const result = await postJson(`/api/liff/incident/${incidentId}/join`);
    if (result.ok) {
      router.refresh();
      return;
    }
    setError(result.error);
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <EmergencyHeader />
      <section className="glass p-5">
        <p className="text-sm font-semibold text-primary-text">
          สาธิต ReachIn · ไม่ใช่เหตุจริง
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          เข้าวงคนช่วยของ{elderName}
        </h1>
        <p className="mt-2 text-muted">
          {elderName}เป็นตัวละครสมมติ เข้าวงแล้วลองรับงานแข่งกับคนอื่นได้เลย
        </p>
        {error && (
          <p role="alert" className="mt-3 font-semibold text-urgent-text">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={join}
          className="btn btn-lg btn-primary mt-4"
        >
          เข้าร่วมวงคนช่วย
        </button>
      </section>
    </main>
  );
}
