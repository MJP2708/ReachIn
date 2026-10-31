'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { postJson } from '@/lib/client-api';

type Gate =
  | { state: 'working' }
  | { state: 'outside' }
  | { state: 'failed'; message: string };

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

/**
 * Sign-in for pages opened from LINE. The ID token goes to the server for
 * verification; the profile from liff.getProfile() is never sent, because it
 * proves nothing.
 *
 * This also has to run on the app root: LIFF's first redirect always lands on
 * the Endpoint URL, and liff.init() is what forwards to the real path.
 */
export function LiffGate({ then }: { then?: string }) {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>(
    LIFF_ID ? { state: 'working' } : { state: 'outside' },
  );

  useEffect(() => {
    if (!LIFF_ID) return;
    let cancelled = false;

    async function signIn(liffId: string) {
      try {
        const liff = (await import('@line/liff')).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const idToken = liff.getIDToken();
        if (!idToken) throw new Error('no id token');
        const result = await postJson('/api/auth/line', { idToken });
        if (cancelled) return;
        if (!result.ok) {
          setGate({ state: 'failed', message: result.error });
          return;
        }
        if (then) router.replace(then);
        else router.refresh();
      } catch {
        if (!cancelled) {
          setGate({
            state: 'failed',
            message: 'เชื่อมต่อกับ LINE ไม่สำเร็จ ลองเปิดจากในแอป LINE อีกครั้ง',
          });
        }
      }
    }

    void signIn(LIFF_ID);
    return () => {
      cancelled = true;
    };
  }, [router, then]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-5">
      <div className="glass p-6 text-center">
        {gate.state === 'working' && (
          <>
            <span className="mx-auto mb-3 block size-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />
            <p role="status" className="text-muted">
              กำลังเข้าสู่ระบบผ่าน LINE…
            </p>
          </>
        )}
        {gate.state === 'outside' && (
          <>
            <h1 className="text-xl font-bold">เปิดหน้านี้จากแอป LINE</h1>
            <p className="mt-2 text-muted">
              ReachIn ใช้บัญชี LINE ของคุณในการยืนยันตัวตน
            </p>
          </>
        )}
        {gate.state === 'failed' && (
          <>
            <h1 className="text-xl font-bold">เข้าสู่ระบบไม่สำเร็จ</h1>
            <p role="alert" className="mt-2 text-muted">
              {gate.message}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
