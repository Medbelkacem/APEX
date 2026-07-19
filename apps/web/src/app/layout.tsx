import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegistration } from '@/components/service-worker';
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
  // iOS ignores the manifest's display mode and icons; these are its equivalents.
  appleWebApp: {
    capable: true,
    title: 'Dental Lab',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
  // `viewport-fit=cover` lets an installed app paint under the notch; the safe
  // area insets in globals.css are what keep content clear of it.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
