import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';

export const metadata: Metadata = {
  title: {
    default: 'Revo',
    template: '%s · Revo'
  },
  description: 'AI-assisted reputation management for local businesses.'
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap'
});

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={manrope.className}>
      <body>{children}</body>
    </html>
  );
}
