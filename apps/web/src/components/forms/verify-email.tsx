'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

type State =
  | { kind: 'working' }
  | { kind: 'done'; approved: boolean; message: string }
  | { kind: 'failed'; message: string };

export function VerifyEmail() {
  const params = useSearchParams();
  const userId = params.get('uid');
  const token = params.get('token');
  const [state, setState] = useState<State>({ kind: 'working' });

  // React 18 mounts effects twice in development. The verification token is
  // single-use, so firing twice would have the second call fail on a link that
  // just worked.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!userId || !token) {
      setState({ kind: 'failed', message: 'This verification link is incomplete.' });
      return;
    }

    authApi
      .verifyEmail({ userId, token })
      .then((res) =>
        setState({ kind: 'done', approved: res.status === 'active', message: res.message }),
      )
      .catch((err) =>
        setState({
          kind: 'failed',
          message:
            err instanceof ApiError
              ? err.message
              : 'We could not confirm this link. Please try again.',
        }),
      );
  }, [userId, token]);

  if (state.kind === 'working') {
    return <p className="text-sm text-slate-500">Confirming your email address…</p>;
  }

  if (state.kind === 'failed') {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-slate-900">Link didn&rsquo;t work</h1>
        <Alert tone="error">{state.message}</Alert>
        <p className="text-sm text-slate-600">
          Verification links expire after 24 hours and can only be used once. If yours has lapsed,
          register again with the same address.
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/register" className="text-brand-700 hover:underline">
            Register again
          </Link>
          <Link href="/login" className="text-brand-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Email confirmed</h1>
      <Alert tone={state.approved ? 'success' : 'info'}>{state.message}</Alert>
      {state.approved && (
        <Link href="/login" className="block text-sm text-brand-700 hover:underline">
          Sign in
        </Link>
      )}
    </div>
  );
}
