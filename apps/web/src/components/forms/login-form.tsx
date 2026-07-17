'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRole } from '@dental/shared-types';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const { user } = await authApi.login(values);
      const dest =
        user.role === UserRole.DENTIST ? '/dashboard' : '/admin/dashboard';
      router.push(dest);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.';
      setError('root', { message });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Access your dentist or admin portal.</p>
      </div>

      {errors.root && <Alert tone="error">{errors.root.message}</Alert>}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-sm text-brand-700 hover:underline">
            Forgot?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        <FieldError>{errors.password?.message}</FieldError>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
