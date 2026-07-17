import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-bold text-brand-700">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-white">D</span>
        Dental Lab
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
