import type { Metadata } from 'next';
import { RegisterForm } from '@/components/forms/register-form';

export const metadata: Metadata = {
  title: 'Register',
  description: 'Create a dentist account to submit cases and track your work.',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
