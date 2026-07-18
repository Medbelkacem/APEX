import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <Link href="/" className="mb-8 text-brand-700" aria-label="Dental Lab — home">
        <Logo className="text-lg" markClassName="h-9 w-9" />
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {children}
      </div>
      <Link href="/" className="mt-6 text-sm text-slate-500 hover:text-brand-700">
        ← Back to website
      </Link>
    </div>
  );
}
