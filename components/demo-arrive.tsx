'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';

/**
 * Visitors are not standing at the house, so the position is simulated. The
 * server still runs its real distance check on it.
 */
export function DemoArrive({
  incidentId,
  label,
}: {
  incidentId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function arrive(distanceM: number) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/demo/arrive', { incidentId, distanceM });
    if (result.ok) {
      router.push(`/liff/incident/${incidentId}/guide`);
      return;
    }
    setError(result.error);
    setBusy(false);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => arrive(50)}
        className="btn btn-lg btn-primary"
      >
        {label}
      </button>
      <p className="mt-1 text-center text-sm text-muted">
        สาธิต: จำลอง GPS ว่าอยู่ห่างบ้าน 50 ม.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-center font-semibold text-urgent-text">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => arrive(500)}
        className="btn btn-quiet"
      >
        ลองกดจากที่ไกล 500 ม.
      </button>
    </div>
  );
}
