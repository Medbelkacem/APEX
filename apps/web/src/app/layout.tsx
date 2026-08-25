import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import localFont from 'next/font/local';
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
 * Muslone, the brand's display face, recovered from the copy the brand book
 * embeds. That copy is a subset: it carries every letter and digit but none of
 * the punctuation, so `muslone.woff2` maps only the glyphs it really has and
 * the marks it lacks — the full stop, hyphen, comma and apostrophe — fall
 * through to Georgia. See `fontFamily.display` in the Tailwind config.
 *
 * Declared at 700 because that single cut is the heavy one the design sets its
 * headlines in, and `Display` asks for `font-bold`: were it declared at 400 the
 * browser would smear a synthetic bold over an already-heavy face.
 */
const muslone = localFont({
  src: '../fonts/muslone.woff2',
  weight: '700',
  style: 'normal',
  variable: '--font-display',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
  // Georgia is the intended stand-in for the missing punctuation, and it is a
  // closer match to Muslone's weight than the metric-adjusted Arial Next would
  // otherwise splice in ahead of it.
  adjustFontFallback: false,
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
    <html lang="en" className={`${poppins.variable} ${muslone.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
