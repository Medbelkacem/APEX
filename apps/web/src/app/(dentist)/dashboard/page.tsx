'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { AsyncSection, Skeleton } from '@/components/ui/data-states';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/data-states';
import { useApi } from '@/lib/hooks/use-api';
import { casesApi } from '@/lib/api/cases';
import { invoicesApi } from '@/lib/api/invoices';
import { formatDate, formatMoney } from '@/lib/utils/format';

export default function DentistDashboardPage() {
  const summary = useApi(() => casesApi.summary());
  const recent = useApi(() => casesApi.recent(5));
  const balance = useApi(() => invoicesApi.outstanding());

  const cards = [
    { label: 'Total cases', value: summary.data?.total },
    { label: 'Active cases', value: summary.data?.active },
    { label: 'Completed', value: summary.data?.completed },
    {
      label: 'Outstanding balance',
      value: balance.data ? formatMoney(balance.data.total, balance.data.currency) : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your cases, invoices, and activity at a glance.
          </p>
        </div>
        <Link href="/cases/new" className={buttonClasses('primary', 'md')}>
          Submit new case
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              {card.value === undefined ? <Skeleton className="h-8 w-20" /> : card.value}
            </div>
          </Card>
        ))}
      </div>

      {summary.data && summary.data.dueSoon > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{summary.data.dueSoon}</strong>{' '}
          {summary.data.dueSoon === 1 ? 'case is' : 'cases are'} due within the next 7 days.{' '}
          <Link href="/cases?bucket=active" className="font-medium underline underline-offset-2">
            Review them
          </Link>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent cases</h2>
          <Link href="/cases" className="text-sm font-medium text-brand-700 hover:underline">
            View all
          </Link>
        </div>

        <AsyncSection
          loading={recent.loading}
          error={recent.error}
          data={recent.data}
          isEmpty={(rows) => rows.length === 0}
          empty={
            <TableWrap>
              <EmptyState
                title="No cases yet"
                description="Submit your first case and it will appear here."
                action={
                  <Link href="/cases/new" className={buttonClasses('primary', 'sm')}>
                    Submit new case
                  </Link>
                }
              />
            </TableWrap>
          }
        >
          {(rows) => (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th className={COL.md}>Type</Th>
                    <Th className={COL.md}>Patient</Th>
                    <Th>Status</Th>
                    <Th className={COL.sm}>Submitted</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <Link
                          href={`/cases/${row.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {row.reference}
                        </Link>
                        {/* Carries the two columns a phone drops. */}
                        <RowMeta className="md:hidden">
                          {row.caseType?.name ?? '—'} · {row.patientReference}
                        </RowMeta>
                      </Td>
                      <Td className={COL.md}>{row.caseType?.name ?? '—'}</Td>
                      <Td className={COL.md}>{row.patientReference}</Td>
                      <Td>
                        {row.currentStatus && (
                          <StatusBadge
                            label={row.currentStatus.label}
                            color={row.currentStatus.color}
                          />
                        )}
                      </Td>
                      <Td className={COL.sm}>{formatDate(row.submittedAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </AsyncSection>
      </section>
    </div>
  );
}
