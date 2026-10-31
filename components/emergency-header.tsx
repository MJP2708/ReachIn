import type { ReactNode } from 'react';
import { Logo } from './logo';

export function EmergencyHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="glass flex items-center justify-between rounded-full px-4 py-2.5">
      <Logo />
      {right}
    </header>
  );
}
