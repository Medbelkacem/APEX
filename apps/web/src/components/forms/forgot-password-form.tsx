'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { authApi } from '@/lib/api/auth';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // The API always responds 202 (no user enumeration), so success is generic.
  async function onSubmit(values: FormValues) {
    await authApi.forgotPassword(values.email).catch(() => undefined);
  }

  if (isSubmitSuccessful) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
        <Alert tone="success">
          If an account exists for that address, we&apos;ve sent a password reset link.
        </Alert>
        <Link href="/login" className="text-sm text-blue-700 hover:underline">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>

      <Link href="/login" className="block text-center text-sm text-blue-700 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
