'use client';

import { Send } from 'lucide-react';
import { useState } from 'react';
import { shareAlertMessage } from '@/lib/line/share';

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

/**
 * Sends a real LINE message from the viewer's own account. Without the
 * Messaging API the server can't message anyone, so a person has to press this.
 */
export function ShareToLine({
  incidentId,
  elderName,
  demo,
  compact = false,
}: {
  incidentId: string;
  elderName: string;
  demo: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!LIFF_ID) return null;

  async function share(liffId: string) {
    setBusy(true);
    setNotice(null);
    try {
      const liff = (await import('@line/liff')).default;
      await liff.init({ liffId });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }
      if (!liff.isApiAvailable('shareTargetPicker')) {
        setNotice('เปิดหน้านี้ในแอป LINE เพื่อส่งแจ้งเตือน');
        return;
      }
      // The bot SDK and LIFF type the same Flex JSON separately.
      const message = shareAlertMessage({ id: incidentId, elderName, demo });
      const sent = await liff.shareTargetPicker(
        [message] as unknown as Parameters<typeof liff.shareTargetPicker>[0],
        { isMultiple: true },
      );
      setNotice(sent ? 'ส่งเข้า LINE แล้ว' : null);
    } catch {
      setNotice('ส่งไม่สำเร็จ ลองเปิดหน้านี้ในแอป LINE');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => share(LIFF_ID)}
        className={`btn ${compact ? 'min-h-11 bg-[#06C755] text-ink' : 'bg-[#06C755] text-ink'}`}
      >
        <Send className="size-5" aria-hidden /> ส่งแจ้งเตือนเข้า LINE
      </button>
      {notice && (
        <output className="mt-1 block text-center text-sm font-semibold">
          {notice}
        </output>
      )}
    </div>
  );
}
