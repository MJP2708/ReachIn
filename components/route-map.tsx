'use client';

import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/geo';

const PIN_HTML =
  '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#fc5e03;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(16,24,40,.3)"></div>';

/** OpenStreetMap needs no key. If tiles fail, the address sheet still works. */
export function RouteMap({ target, label }: { target: LatLng; label: string }) {
  const element = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import('leaflet').Map | undefined;
    let cancelled = false;

    void import('leaflet').then(({ default: L }) => {
      if (cancelled || !element.current) return;
      map = L.map(element.current, { zoomControl: false }).setView(
        [target.lat, target.lng],
        16,
      );
      let errors = 0;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      })
        .on('tileerror', () => {
          errors += 1;
          if (errors >= 4) setFailed(true);
        })
        .addTo(map);
      L.marker([target.lat, target.lng], {
        title: label,
        icon: L.divIcon({ html: PIN_HTML, className: '', iconSize: [28, 28], iconAnchor: [14, 30] }),
      }).addTo(map);
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [target.lat, target.lng, label]);

  if (failed) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 bg-[#eef1f5] p-6 text-center text-muted">
        <MapPin className="size-8 text-urgent" aria-hidden />
        <p>โหลดแผนที่ไม่สำเร็จ ใช้ปุ่ม Google Maps ด้านล่างได้</p>
      </div>
    );
  }
  return <div ref={element} className="size-full" />;
}
