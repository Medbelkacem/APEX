'use client';

import { useState } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState } from '@/components/ui/data-states';
import { BarList, ChartFrame } from '@/components/charts/charts';
import { useApi } from '@/lib/hooks/use-api';
import { statisticsApi, type ReportName } from '@/lib/api/admin';
import { formatDate, formatMoney } from '@/lib/utils/format';

interface DentistRankingRow {
  dentistId: string;
  name: string;
  clinicName: string | null;
  cases: number;
  revenue: string;
}

interface RevenueByCaseTypeRow {
  label: string;
  value: number;
}

interface TurnaroundRow {
  label: string;
  days: number;
  cases: number;
}

type ReportRow = DentistRankingRow | RevenueByCaseTypeRow | TurnaroundRow;

const REPORTS: Array<{ name: ReportName; label: string; description: string }> = [
  {
    name: 'dentist-ranking',
    label: 'Dentist ranking',
    description: 'Case volume and collected revenue per dentist.',
  },
  {
    name: 'revenue-by-case-type',
    label: 'Revenue by case type',
    description: 'Paid invoice totals split by the originating case type.',
  },
  {
    name: 'turnaround',
    label: 'Turnaround',
    description: 'Mean days from submission to completion, per case type.',
  },
];

/** Bars stay legible; the table below carries the full ranking. */
const MAX_BARS = 10;

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/** Chart beside the table: magnitude at a glance, exact figures on the right. */
function ReportGrid({ chart, children }: { chart: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div>{chart}</div>
      <TableWrap className="lg:col-span-2">{children}</TableWrap>
    </div>
  );
}

function DentistRankingReport({ rows, subtitle }: { rows: DentistRankingRow[]; subtitle: string }) {
  return (
    <ReportGrid
      chart={
        <ChartFrame title="Cases by dentist" subtitle={subtitle}>
          <BarList
            rows={rows.slice(0, MAX_BARS).map((row) => ({ label: row.name, value: row.cases }))}
          />
        </ChartFrame>
      }
    >
      <Table className="md:min-w-[32rem]">
        <thead>
          <tr>
            <Th>Dentist</Th>
            <Th className={COL.md}>Clinic</Th>
            <Th className="text-right">Cases</Th>
            <Th className="text-right">Revenue</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Tr key={row.dentistId}>
              <Td className="font-medium text-slate-900">
                {row.name}
                {row.clinicName && (
                  <RowMeta className="font-normal md:hidden">{row.clinicName}</RowMeta>
                )}
              </Td>
              <Td className={COL.md}>{row.clinicName ?? '—'}</Td>
              <Td className="text-right tabular-nums">{row.cases}</Td>
              <Td className="text-right tabular-nums">{formatMoney(row.revenue)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </ReportGrid>
  );
}

function RevenueByCaseTypeReport({
  rows,
  subtitle,
}: {
  rows: RevenueByCaseTypeRow[];
  subtitle: string;
}) {
  return (
    <ReportGrid
      chart={
        <ChartFrame title="Revenue share" subtitle={subtitle}>
          <BarList rows={rows.slice(0, MAX_BARS)} formatValue={(v) => formatMoney(v)} />
        </ChartFrame>
      }
    >
      <Table>
        <thead>
          <tr>
            <Th>Case type</Th>
            <Th className="text-right">Revenue</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Tr key={row.label}>
              <Td className="font-medium text-slate-900">{row.label}</Td>
              <Td className="text-right tabular-nums">{formatMoney(row.value)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </ReportGrid>
  );
}

function TurnaroundReport({ rows, subtitle }: { rows: TurnaroundRow[]; subtitle: string }) {
  return (
    <ReportGrid
      chart={
        <ChartFrame title="Average turnaround" subtitle={subtitle}>
          <BarList
            rows={rows.slice(0, MAX_BARS).map((row) => ({ label: row.label, value: row.days }))}
            formatValue={(v) => `${v} d`}
          />
        </ChartFrame>
      }
    >
      <Table>
        <thead>
          <tr>
            <Th>Case type</Th>
            <Th className="text-right">Avg days</Th>
            <Th className="text-right">Cases completed</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Tr key={row.label}>
              <Td className="font-medium text-slate-900">{row.label}</Td>
              <Td className="text-right tabular-nums">{row.days}</Td>
              <Td className="text-right tabular-nums">{row.cases}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </ReportGrid>
  );
}

export default function AdminStatisticsPage() {
  const [report, setReport] = useState<ReportName>('dentist-ranking');
  const [range, setRange] = useState(defaultRange);

  const active = REPORTS.find((r) => r.name === report) ?? REPORTS[0];

  const result = useApi(
    // Tag the response with the report it came from: `useApi` keeps the previous
    // data while refetching, and rows only make sense under their own columns.
    async () => ({ report, ...(await statisticsApi.report<ReportRow>(report, range)) }),
    [report, range.from, range.to],
  );

  const subtitle = result.data
    ? `${formatDate(result.data.range.from)} – ${formatDate(result.data.range.to)}`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Statistics &amp; reports</h1>
          <p className="mt-1 text-sm text-slate-500">{active.description}</p>
        </div>
        {/* Plain link, not fetch: the session cookie authenticates it and the
            browser handles the file download. */}
        <a href={statisticsApi.exportUrl(report, range)} className={buttonClasses('outline', 'md')}>
          Download CSV
        </a>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Label htmlFor="report">Report</Label>
            <Select
              id="report"
              value={report}
              onChange={(e) => setReport(e.target.value as ReportName)}
            >
              {REPORTS.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <AsyncSection
        loading={result.loading}
        error={result.error}
        data={result.data}
        isEmpty={(data) => data.rows.length === 0}
        empty={
          <TableWrap>
            <EmptyState
              title="Nothing to report for this period"
              description="Widen the date range, or pick another report."
            />
          </TableWrap>
        }
      >
        {(data) => (
          <>
            {/* The report name is what fixes the row shape, so narrow on it. */}
            {data.report === 'dentist-ranking' && (
              <DentistRankingReport rows={data.rows as DentistRankingRow[]} subtitle={subtitle} />
            )}
            {data.report === 'revenue-by-case-type' && (
              <RevenueByCaseTypeReport
                rows={data.rows as RevenueByCaseTypeRow[]}
                subtitle={subtitle}
              />
            )}
            {data.report === 'turnaround' && (
              <TurnaroundReport rows={data.rows as TurnaroundRow[]} subtitle={subtitle} />
            )}
          </>
        )}
      </AsyncSection>
    </div>
  );
}
