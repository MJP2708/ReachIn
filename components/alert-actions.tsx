'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';

export function AlertActions({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  async function accept() {
    setBusy(true);
    const result = await postJson(`/api/liff/incident/${incidentId}/accept`);
    if (result.ok) {
      router.push(`/liff/incident/${incidentId}/route`);
      return;
    }
    setMessage(result.error);
    setBusy(false);
    router.refresh();
  }

  async function decline() {
    setBusy(true);
    await postJson(`/api/liff/incident/${incidentId}/decline`);
    setDeclined(true);
    setBusy(false);
  }

  if (declined) {
    return (
      <p role="status" className="glass p-4 text-center text-muted">
        รับทราบ ขอบคุณที่แจ้ง ถ้าไปได้ภายหลังกดรับงานจากข้อความได้
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {message && (
        <p role="alert" className="mb-2 text-center font-semibold text-urgent-text">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={accept}
        className="btn btn-lg btn-primary"
      >
        รับงาน ไปช่วยเลย
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={decline}
        className="btn btn-quiet"
      >
        ตอนนี้ไปไม่ได้
      </button>
    </div>
  );
}
