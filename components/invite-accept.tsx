'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';

export function InviteAccept({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    const result = await postJson<{ elderId: string }>(`/api/liff/invite/${token}`);
    if (result.ok) {
      router.push(`/liff/elder/${result.elderId}`);
      return;
    }
    setError(result.error);
    setBusy(false);
  }

  return (
    <>
      {error && (
        <p role="alert" className="mt-3 font-semibold text-urgent-text">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={accept}
        className="btn btn-lg btn-primary mt-4"
      >
        เข้าร่วมวงคนช่วย
      </button>
    </>
  );
}
