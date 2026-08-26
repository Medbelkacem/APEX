import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-50 px-4 py-10 sm:py-12">
      <Link href="/" className="mb-6 text-navy-700 sm:mb-8" aria-label="Apex — home">
        <Logo size="lg" />
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-navy-100/60 bg-white p-6 shadow-sm sm:p-8">
        {children}
      </div>
      <Link href="/" className="mt-6 text-sm text-navy-600/70 hover:text-blue-700">
        ← Back to website
      </Link>
    </div>
  );
}
