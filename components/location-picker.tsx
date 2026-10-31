'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/geo';

const BANGKOK: LatLng = { lat: 13.7563, lng: 100.5018 };

export function LocationPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const place = useRef<((point: LatLng) => void) | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let map: import('leaflet').Map | undefined;
    let cancelled = false;

    void import('leaflet').then(({ default: L }) => {
      if (cancelled || !element.current) return;
      const created = L.map(element.current).setView([BANGKOK.lat, BANGKOK.lng], 12);
      map = created;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(created);
      const marker = L.circleMarker([0, 0], {
        radius: 9,
        color: '#fff',
        weight: 3,
        fillColor: '#fc5e03',
        fillOpacity: 1,
      });
      place.current = ({ lat, lng }) => {
        marker.setLatLng([lat, lng]).addTo(created);
        created.setView([lat, lng], Math.max(created.getZoom(), 16));
      };
      created.on('click', ({ latlng }) => {
        const point = { lat: latlng.lat, lng: latlng.lng };
        place.current?.(point);
        onChange(point);
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
    // The map is created once; onChange only ever sets parent state.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  function useMyLocation() {
    setHint('กำลังหาตำแหน่ง…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        place.current?.(point);
        onChange(point);
        setHint(null);
      },
      () => setHint('หาตำแหน่งไม่สำเร็จ แตะบนแผนที่แทนได้'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div>
      <div ref={element} className="h-56 w-full overflow-hidden rounded-2xl" />
      <button type="button" onClick={useMyLocation} className="btn btn-soft mt-2">
        ใช้ตำแหน่งปัจจุบัน
      </button>
      <p className="mt-1 text-sm text-muted">
        {hint ??
          (value
            ? `เลือกแล้ว ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
            : 'แตะบนแผนที่เพื่อเลือกบ้าน')}
      </p>
    </div>
  );
}
