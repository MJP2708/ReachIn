'use client';

import { useEffect, useState } from 'react';

const NOTICE_MS = 3500;

/**
 * A tel: link really opens the dialer, and a public demo must not lead anyone
 * to call 1669 or a made-up number that may belong to a real person.
 */
export function DemoTelGuard() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function onClick(event: MouseEvent) {
      const target = event.target as Element;
      if (!target.closest?.('a[href^="tel:"]')) return;
      event.preventDefault();
      setShown(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(false), NOTICE_MS);
    }
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      clearTimeout(timer);
    };
  }, []);

  if (!shown) return null;
  return (
    <output className="fixed inset-x-4 top-14 z-[2000] mx-auto block max-w-md rounded-2xl bg-ink p-3 text-center font-semibold text-white shadow-glass-lg">
      สาธิต: ของจริงปุ่มนี้จะโทรออก ตอนนี้ไม่ได้โทรจริง
    </output>
  );
}
