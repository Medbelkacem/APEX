import { cn } from '@/lib/utils/cn';

type Tone = 'success' | 'error' | 'info';

const tones: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-brand-200 bg-brand-50 text-brand-800',
};

export function Alert({ tone = 'info', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div role="alert" className={cn('rounded-lg border px-4 py-3 text-sm', tones[tone])}>
      {children}
    </div>
  );
}
