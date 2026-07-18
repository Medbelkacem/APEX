'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { BarList, ChartFrame, StatTile, TimeSeriesChart } from '@/components/charts/charts';
import { useApi } from '@/lib/hooks/use-api';
import { statisticsApi } from '@/lib/api/admin';
import { formatMoney, timeAgo } from '@/lib/utils/format';

/** Selectable reporting windows, in days back from today. */
const RANGES = [
  { label: 'Last 7 days', days: 7, granularity: 'day' as const },
  { label: 'Last 30 days', days: 30, granularity: 'day' as const },
  { label: 'Last 90 days', days: 90, granularity: 'day' as const },
  { label: 'Last 12 months', days: 365, granularity: 'month' as const },
];

function rangeFor(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function AdminDashboardPage() {
  const [rangeIndex, setRangeIndex] = useState(1);
  const preset = RANGES[rangeIndex];

  const overview = useApi(
    () => statisticsApi.overview({ ...rangeFor(preset.days), granularity: preset.granularity }),
    [rangeIndex],
  );

  const kpis = overview.data?.kpis;
  const loading = overview.loading && !overview.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Operational overview of the laboratory.</p>
        </div>
        {/* Filters sit in one row above the charts. */}
        <div className="w-full sm:w-56">
          <Select
            aria-label="Reporting period"
            value={rangeIndex}
            onChange={(e) => setRangeIndex(Number(e.target.value))}
          >
            {RANGES.map((range, index) => (
              <option key={range.label} value={index}>
                {range.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {overview.error && <Alert tone="error">{overview.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Cases this month"
          value={kpis?.casesThisMonth ?? 0}
          hint={kpis ? `${kpis.casesToday} today · ${kpis.casesThisWeek} this week` : undefined}
          loading={loading}
        />
        <StatTile
          label="Revenue this month"
          value={formatMoney(kpis?.revenueThisMonth)}
          hint={kpis ? `${formatMoney(kpis.outstandingTotal)} outstanding` : undefined}
          loading={loading}
        />
        <StatTile label="Active dentists" value={kpis?.activeDentists ?? 0} loading={loading} />
        <StatTile
          label="Avg turnaround"
          value={kpis?.avgTurnaroundDays === null || kpis?.avgTurnaroundDays === undefined
            ? '—'
            : `${kpis.avgTurnaroundDays} d`}
          hint={kpis ? `${kpis.activeCases} cases in production` : undefined}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Cases submitted" subtitle={preset.label}>
          {overview.data ? (
            <TimeSeriesChart data={overview.data.casesOverTime} valueLabel="Cases" />
          ) : (
            <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
          )}
        </ChartFrame>

        <ChartFrame title="Revenue collected" subtitle={preset.label}>
          {overview.data ? (
            <TimeSeriesChart
              data={overview.data.revenueOverTime}
              valueLabel="Revenue"
              formatValue={(v) => formatMoney(v)}
            />
          ) : (
            <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
          )}
        </ChartFrame>

        <ChartFrame title="Cases by type" subtitle={preset.label}>
          <BarList rows={overview.data?.caseTypes ?? []} emptyLabel="No cases in this period" />
        </ChartFrame>

        <ChartFrame title="Cases by workflow status" subtitle="All open and closed cases">
          {/* Each status keeps its configured colour; the label carries identity. */}
          <BarList rows={overview.data?.statuses ?? []} emptyLabel="No cases yet" />
        </ChartFrame>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
          <Link href="/admin/cases" className="text-sm font-medium text-brand-700 hover:underline">
            All cases
          </Link>
        </div>
        {overview.data?.activity.length === 0 && (
          <p className="text-sm text-slate-500">No case activity yet.</p>
        )}
        <ul className="divide-y divide-slate-100">
          {overview.data?.activity.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/cases/${item.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {item.reference}
                </Link>
                <span className="ml-2 text-sm text-slate-500">{item.dentistName}</span>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge
                  label={item.status}
                  color={
                    overview.data?.statuses.find((s) => s.label === item.status)?.color ?? '#64748b'
                  }
                />
                <span className="text-xs text-slate-400">{timeAgo(item.at)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
