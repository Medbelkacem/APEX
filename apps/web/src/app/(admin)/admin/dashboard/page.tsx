import { Card } from '@/components/ui/card';

const KPIS = [
  { label: 'Cases this month', value: '—' },
  { label: 'Revenue', value: '—' },
  { label: 'Active dentists', value: '—' },
  { label: 'Avg turnaround', value: '—' },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Operational overview of the laboratory.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label}>
            <div className="text-sm text-slate-500">{k.label}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{k.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Charts &amp; activity</h2>
        <p className="mt-2 text-sm text-slate-500">
          Dentist, case-workflow, pricing, invoicing, and statistics management land in Weeks 3–4.
          This shell confirms the admin route group and RBAC redirect are wired.
        </p>
      </Card>
    </div>
  );
}
