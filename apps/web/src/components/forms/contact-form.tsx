'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, FieldError } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { contactApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  name: z.string().min(1, 'Please enter your name').max(150),
  email: z.string().email('Enter a valid email'),
  subject: z.string().min(1, 'Please enter a subject').max(255),
  message: z.string().min(1, 'Please enter a message').max(5000),
});

type FormValues = z.infer<typeof schema>;

export function ContactForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await contactApi.submit(values);
      reset();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setError('root', { message });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {isSubmitSuccessful && !errors.root && (
        <Alert tone="success">Thank you — we&apos;ll get back to you shortly.</Alert>
      )}
      {errors.root && <Alert tone="error">{errors.root.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" autoComplete="name" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" {...register('subject')} />
        <FieldError>{errors.subject?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" {...register('message')} />
        <FieldError>{errors.message?.message}</FieldError>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  );
}
