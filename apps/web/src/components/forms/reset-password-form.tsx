'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

// Mirrors the API password policy for instant client-side feedback.
const schema = z
  .object({
    password: z
      .string()
      .min(10, 'At least 10 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get('uid') ?? '';
  const token = params.get('token') ?? '';
  const isSetup = params.get('setup') === '1';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const missingLink = !userId || !token;

  async function onSubmit(values: FormValues) {
    try {
      const payload = { userId, token, password: values.password };
      if (isSetup) await authApi.setupPassword(payload);
      else await authApi.resetPassword(payload);
      router.push('/login?reset=1');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to reset password. The link may have expired.';
      setError('root', { message });
    }
  }

  if (missingLink) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Invalid link</h1>
        <Alert tone="error">This reset link is missing information. Please request a new one.</Alert>
        <Link href="/forgot-password" className="text-sm text-brand-700 hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isSetup ? 'Set your password' : 'Choose a new password'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isSetup ? 'Welcome! Create a password to activate your account.' : 'Enter a new password below.'}
        </p>
      </div>

      {errors.root && <Alert tone="error">{errors.root.message}</Alert>}

      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        <FieldError>{errors.password?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
        <FieldError>{errors.confirm?.message}</FieldError>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : isSetup ? 'Activate account' : 'Reset password'}
      </Button>
    </form>
  );
}
