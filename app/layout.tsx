import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const noto = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-noto-thai',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ReachIn',
  description: 'ReachIn รู้ทันการล้ม คนถึงตัวไว ลูกหลานสบายใจ',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F7F9FC',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={noto.variable}>
      <body>{children}</body>
    </html>
  );
}
