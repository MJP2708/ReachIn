'use client';

import { CircleAlert, SearchX } from 'lucide-react';
import Link from 'next/link';

export function Loading() {
  return (
    <main
      role="status"
      className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6"
    >
      <span className="size-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />
      <p className="text-muted">กำลังโหลด…</p>
    </main>
  );
}

export function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-5">
      <div className="glass p-6 text-center">
        <CircleAlert className="mx-auto mb-3 size-10 text-urgent" aria-hidden />
        <h1 className="text-xl font-bold">โหลดหน้านี้ไม่สำเร็จ</h1>
        <p className="mt-2 text-muted">
          ลองใหม่อีกครั้ง ถ้าเป็นเหตุฉุกเฉินให้โทร 1669 ได้เลย
        </p>
        <button type="button" onClick={reset} className="btn btn-primary mt-4">
          ลองใหม่
        </button>
        <a href="tel:1669" className="btn btn-quiet mt-1">
          โทร 1669
        </a>
      </div>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-5">
      <div className="glass p-6 text-center">
        <SearchX className="mx-auto mb-3 size-10 text-muted" aria-hidden />
        <h1 className="text-xl font-bold">ไม่พบหน้านี้</h1>
        <p className="mt-2 text-muted">
          ลิงก์อาจหมดอายุ หรือคุณไม่ได้อยู่ในวงคนช่วยของผู้สูงอายุท่านนี้
        </p>
        <Link href="/liff/home" className="btn btn-soft mt-4">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
