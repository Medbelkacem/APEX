import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VerifyEmail } from '@/components/forms/verify-email';

export const metadata: Metadata = { title: 'Confirm your email' };

export default function VerifyEmailPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <VerifyEmail />
    </Suspense>
  );
}
