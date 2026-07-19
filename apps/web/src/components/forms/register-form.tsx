'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

/** Mirrors the API's password policy so the rules are stated before submitting. */
const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

const schema = z
  .object({
    firstName: z.string().min(1, 'Enter your first name'),
    lastName: z.string().min(1, 'Enter your last name'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().optional(),
    clinicName: z.string().optional(),
    clinicAddress: z.string().optional(),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

const orNull = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function RegisterForm() {
  const [submittedTo, setSubmittedTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await authApi.register({
        email: values.email.trim(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: orNull(values.phone),
        clinicName: orNull(values.clinicName),
        clinicAddress: orNull(values.clinicAddress),
      });
      setSubmittedTo(values.email.trim());
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to register. Please try again.';
      setError('root', { message });
    }
  }

  /*
   * The success screen never says whether the address was new. The API answers
   * registration identically either way so the form cannot be used to ask who
   * banks with this lab, and saying more here would give that away again.
   */
  if (submittedTo) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
          <p className="mt-2 text-sm text-slate-600">
            If we can set up an account for <span className="font-medium">{submittedTo}</span>,
            a confirmation link is on its way. Open it to confirm your address.
          </p>
        </div>
        <Alert tone="info">
          Once confirmed, the laboratory reviews your application. We&rsquo;ll email you as soon as
          your account is open — you won&rsquo;t be able to sign in until then.
        </Alert>
        <Link href="/login" className="block text-sm text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Register your practice</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a dentist account to submit cases and track your work.
        </p>
      </div>

      {errors.root && <Alert tone="error">{errors.root.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
          <FieldError>{errors.firstName?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
          <FieldError>{errors.lastName?.message}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" type="tel" autoComplete="tel" {...register('phone')} />
        <FieldError>{errors.phone?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="clinicName">Clinic name (optional)</Label>
        <Input id="clinicName" autoComplete="organization" {...register('clinicName')} />
        <FieldError>{errors.clinicName?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="clinicAddress">Clinic address (optional)</Label>
        <Input id="clinicAddress" autoComplete="street-address" {...register('clinicAddress')} />
        <FieldError>{errors.clinicAddress?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
        />
        <FieldError>{errors.password?.message}</FieldError>
        <p className="mt-1 text-xs text-slate-500">
          At least 10 characters, with an uppercase letter, a lowercase letter and a number.
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        <FieldError>{errors.confirmPassword?.message}</FieldError>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-sm text-slate-500">
        Already registered?{' '}
        <Link href="/login" className="text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
