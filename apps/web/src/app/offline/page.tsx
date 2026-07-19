import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/**
 * Shown by the service worker when a navigation fails with no network.
 *
 * Static by necessity: it is precached at install time, long before anyone
 * signs in, so it cannot render anything belonging to a user.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">You&rsquo;re offline</h1>
      <p className="mt-3 text-sm text-slate-600">
        This page needs a connection. Your cases, scans and invoices are kept on the server rather
        than on this device, so they&rsquo;ll be here as soon as you&rsquo;re back online.
      </p>
      <p className="mt-8 text-sm text-slate-500">
        Reconnect, then{' '}
        <Link href="/dashboard" className="text-brand-700 hover:underline">
          return to your dashboard
        </Link>
        .
      </p>
    </main>
  );
}
