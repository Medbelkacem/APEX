import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/forms/reset-password-form';

export const metadata: Metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
