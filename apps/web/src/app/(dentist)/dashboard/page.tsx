import { Card } from '@/components/ui/card';

const SUMMARY = [
  { label: 'Total cases', value: '—' },
  { label: 'Active cases', value: '—' },
  { label: 'Completed', value: '—' },
  { label: 'Outstanding balance', value: '—' },
];

export default function DentistDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your cases, invoices, and activity at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY.map((s) => (
          <Card key={s.label}>
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Recent cases</h2>
        <p className="mt-2 text-sm text-slate-500">
          Case submission and tracking arrive in Week 2 of the build. This shell confirms the
          authenticated dentist route group is wired end-to-end.
        </p>
      </Card>
    </div>
  );
}
