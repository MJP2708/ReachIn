import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { DemoTelGuard } from './demo-tel-guard';

const BAR_HEIGHT = '2.75rem';

/** Always shows this is a demo, and the way back to the controls. */
export function DemoBar({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <div style={{ '--demo-bar': BAR_HEIGHT } as CSSProperties}>
      <div
        style={{ height: BAR_HEIGHT }}
        className="flex items-center justify-between gap-2 bg-ink px-4 text-sm text-white"
      >
        <span className="truncate">สาธิต · {name}</span>
        <span className="flex h-full shrink-0 gap-4">
          <Link
            href="/liff/line"
            prefetch={false}
            className="flex h-full items-center font-semibold underline"
          >
            แชต LINE
          </Link>
          <Link
            href="/demo"
            prefetch={false}
            className="flex h-full items-center font-semibold underline"
          >
            แผงควบคุม
          </Link>
        </span>
      </div>
      {children}
      <DemoTelGuard />
    </div>
  );
}
