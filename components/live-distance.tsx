'use client';

import { useEffect, useState } from 'react';
import { haversineMetres, walkingMinutes, type LatLng } from '@/lib/geo';

/**
 * Distance from this phone. Only reads GPS if permission was already granted,
 * so opening a list never triggers a prompt.
 */
export function useDistance(target: LatLng, ask = false) {
  const [metres, setMetres] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function read() {
      if (!('geolocation' in navigator)) return;
      if (!ask) {
        const permission = await navigator.permissions
          ?.query({ name: 'geolocation' })
          .catch(() => null);
        if (permission?.state !== 'granted') return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (cancelled) return;
          setMetres(
            haversineMetres(
              { lat: coords.latitude, lng: coords.longitude },
              target,
            ),
          );
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
      );
    }
    void read();
    return () => {
      cancelled = true;
    };
  }, [ask, target]);

  return metres;
}

export function formatDistance(metres: number) {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} กม.`
    : `${Math.round(metres / 10) * 10} ม.`;
}

export function DistanceLabel({
  lat,
  lng,
  suffix = '',
}: LatLng & { suffix?: string }) {
  const [target] = useState({ lat, lng });
  const metres = useDistance(target);
  return metres === null ? null : <>ห่าง {formatDistance(metres)}{suffix}</>;
}

export function DistanceStat({
  lat,
  lng,
  fixedMetres,
}: LatLng & { fixedMetres?: number }) {
  const [target] = useState({ lat, lng });
  const measured = useDistance(target, fixedMetres === undefined);
  const metres = fixedMetres ?? measured;
  return (
    <div className="rounded-[20px] bg-white/85 p-3.5">
      <p className="text-sm text-muted">ห่างจากคุณ</p>
      <p className="text-xl font-bold">
        {metres === null ? 'ไม่ทราบ' : formatDistance(metres)}
      </p>
      <p className="text-sm text-muted">
        {metres === null
          ? 'เปิดตำแหน่งเพื่อดูระยะ'
          : `เดินประมาณ ${walkingMinutes(metres)} นาที`}
      </p>
    </div>
  );
}
