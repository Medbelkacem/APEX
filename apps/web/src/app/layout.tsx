import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Dental Lab — Digital Case Management for Dentists',
    template: '%s · Dental Lab',
  },
  description:
    'Submit dental cases, upload STL scans, track production, and manage invoices — a modern portal connecting dentists with our laboratory.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'Dental Lab',
    description: 'Digital case management for dentists and dental laboratories.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
