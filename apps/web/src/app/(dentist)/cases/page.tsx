'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buttonClasses } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState } from '@/components/ui/data-states';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/lib/hooks/use-api';
import { casesApi, type CaseListQuery } from '@/lib/api/cases';
import { catalogApi } from '@/lib/api/catalog';
import { formatDate } from '@/lib/utils/format';

function CasesView() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<CaseListQuery>({
    bucket: (params.get('bucket') as CaseListQuery['bucket']) ?? 'all',
    status: params.get('status') ?? '',
    caseTypeId: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 20,
  });

  const patch = (next: Partial<CaseListQuery>) =>
    // Any filter change resets to page 1 — otherwise you can land on an empty page.
    setFilters((prev) => ({ ...prev, ...next, page: next.page ?? 1 }));

  const statuses = useApi(() => catalogApi.statuses(), []);
  const caseTypes = useApi(() => catalogApi.caseTypes(), []);
  const cases = useApi(
    () => casesApi.list(filters),
    [
      filters.bucket,
      filters.status,
      filters.caseTypeId,
      filters.search,
      filters.dateFrom,
      filters.dateTo,
      filters.page,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My cases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track every case you have submitted to the laboratory.
          </p>
        </div>
        <Link href="/cases/new" className={buttonClasses('primary', 'md')}>
          Submit new case
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Reference, patient, material…"
              value={filters.search ?? ''}
              onChange={(e) => patch({ search: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={filters.status ?? ''}
              onChange={(e) => patch({ status: e.target.value })}
            >
              <option value="">All statuses</option>
              {statuses.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="caseType">Case type</Label>
            <Select
              id="caseType"
              value={filters.caseTypeId ?? ''}
              onChange={(e) => patch({ caseTypeId: e.target.value })}
            >
              <option value="">All types</option>
              {caseTypes.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="bucket">Show</Label>
            <Select
              id="bucket"
              value={filters.bucket ?? 'all'}
              onChange={(e) => patch({ bucket: e.target.value as CaseListQuery['bucket'] })}
            >
              <option value="all">All cases</option>
              <option value="active">In progress</option>
              <option value="completed">Completed</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="dateFrom">Submitted from</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => patch({ dateFrom: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="dateTo">Submitted to</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => patch({ dateTo: e.target.value })}
            />
          </div>
        </div>
      </div>

      <AsyncSection
        loading={cases.loading}
        error={cases.error}
        data={cases.data}
        isEmpty={(page) => page.data.length === 0}
        empty={
          <TableWrap>
            <EmptyState
              title="No cases match these filters"
              description="Try clearing the search or date range."
            />
          </TableWrap>
        }
      >
        {(page) => (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th className={COL.md}>Type</Th>
                  <Th className={COL.md}>Patient</Th>
                  <Th>Status</Th>
                  <Th className={COL.sm}>Deadline</Th>
                  <Th className={COL.lg}>Submitted</Th>
                </tr>
              </thead>
              <tbody>
                {page.data.map((row) => (
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
                    <Td className={COL.sm}>{formatDate(row.deadline)}</Td>
                    <Td className={COL.lg}>{formatDate(row.submittedAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={page.meta} onChange={(p) => patch({ page: p })} />
          </TableWrap>
        )}
      </AsyncSection>
    </div>
  );
}

export default function CasesPage() {
  // useSearchParams needs a Suspense boundary to keep the route statically shell-able.
  return (
    <Suspense fallback={null}>
      <CasesView />
    </Suspense>
  );
}
