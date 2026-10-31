'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';

export function StartDemo() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const result = await postJson<{ incidentId: string }>('/api/demo/start');
    if (result.ok) {
      router.push('/liff/line');
      return;
    }
    setError(result.error);
    setBusy(false);
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-2 text-center font-semibold text-urgent-text">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="btn btn-lg btn-urgent"
      >
        {busy ? 'กำลังจำลองการล้ม…' : 'เริ่มสาธิต: คุณยายล้ม'}
      </button>
    </>
  );
}
