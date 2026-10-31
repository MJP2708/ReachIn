'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';

const LOCATION_ERRORS: Record<number, string> = {
  1: 'ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง เปิดสิทธิ์แล้วลองใหม่',
  2: 'หาตำแหน่งไม่เจอ ลองออกไปที่โล่งแล้วกดอีกครั้ง',
  3: 'หาตำแหน่งนานเกินไป ลองใหม่อีกครั้ง',
};

export function ArriveButton({
  incidentId,
  label,
}: {
  incidentId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function arrive() {
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const result = await postJson(`/api/liff/incident/${incidentId}/arrive`, {
          lat: coords.latitude,
          lng: coords.longitude,
        });
        if (result.ok) {
          router.push(`/liff/incident/${incidentId}/guide`);
          return;
        }
        setError(result.error);
        setBusy(false);
      },
      (failure) => {
        setError(LOCATION_ERRORS[failure.code] ?? LOCATION_ERRORS[2]!);
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );
  }

  return (
    <div className="flex-1">
      <button
        type="button"
        disabled={busy}
        onClick={arrive}
        className="btn btn-lg btn-primary"
      >
        {busy ? 'กำลังตรวจตำแหน่ง…' : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center font-semibold text-urgent-text">
          {error}
        </p>
      )}
    </div>
  );
}
