import type { Metadata, Viewport } from 'next';
import { Poppins, Fraunces } from 'next/font/google';
import { ServiceWorkerRegistration } from '@/components/service-worker';
import '@/styles/globals.css';

/** The brand's workhorse face — every weight the guidelines specify. */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

/**
 * Stand-in for Muslone, the licensed display face.
 *
 * Loaded as the variable font so the optical-size axis comes with it: Fraunces
 * defaults `opsz` to its text cut, whose serifs are far too sturdy at headline
 * size, and globals.css pins it to the display end.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Apex — Digital Lab Partner for US General Dentists',
    template: '%s · Apex',
  },
  description:
    'Apex is a focused-SKU digital lab partner for US general dentists. Submit cases, upload STL scans, track production, and settle invoices in one portal.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'Apex Digital Lab',
    description: 'Consistent fit. Predictable turnaround. A fully digital restorative workflow.',
    type: 'website',
  },
  robots: { index: true, follow: true },
  // iOS ignores the manifest's display mode and icons; these are its equivalents.
  appleWebApp: {
    capable: true,
    title: 'Apex',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#001e47',
  // `viewport-fit=cover` lets an installed app paint under the notch; the safe
  // area insets in globals.css are what keep content clear of it.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${fraunces.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
