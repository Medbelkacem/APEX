'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StatusBadge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState } from '@/components/ui/data-states';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/lib/hooks/use-api';
import { casesApi, type CaseListQuery } from '@/lib/api/cases';
import { catalogApi } from '@/lib/api/catalog';
import { dentistsApi } from '@/lib/api/admin';
import { formatDate } from '@/lib/utils/format';

function AdminCasesView() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<CaseListQuery>({
    status: '',
    caseTypeId: '',
    // Seeded from the URL so "All cases" links from a dentist's page land
    // pre-filtered to that dentist.
    dentistId: params.get('dentistId') ?? '',
    search: '',
    dateFrom: '',
    dateTo: '',
    bucket: 'all',
    page: 1,
    limit: 20,
  });

  const patch = (next: Partial<CaseListQuery>) =>
    setFilters((prev) => ({ ...prev, ...next, page: next.page ?? 1 }));

  const statuses = useApi(() => catalogApi.statuses(), []);
  const caseTypes = useApi(() => catalogApi.caseTypes(), []);
  // A large practice list would need a typeahead; the flat list is fine at
  // laboratory scale and keeps the filter row synchronous.
  const dentists = useApi(() => dentistsApi.list({ limit: 100 }), []);

  const cases = useApi(
    () => casesApi.list(filters),
    [
      filters.status,
      filters.caseTypeId,
      filters.dentistId,
      filters.search,
      filters.dateFrom,
      filters.dateTo,
      filters.bucket,
      filters.page,
    ],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cases</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every case in the laboratory, across all dentists.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <Label htmlFor="dentist">Dentist</Label>
            <Select
              id="dentist"
              value={filters.dentistId ?? ''}
              onChange={(e) => patch({ dentistId: e.target.value })}
            >
              <option value="">All dentists</option>
              {dentists.data?.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.user.firstName} {d.user.lastName}
                  {d.clinicName ? ` — ${d.clinicName}` : ''}
                </option>
              ))}
            </Select>
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
              <option value="active">In production</option>
              <option value="completed">Closed</option>
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
            <EmptyState title="No cases match these filters" />
          </TableWrap>
        }
      >
        {(page) => (
          <TableWrap>
            <Table className="md:min-w-[52rem]">
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th className={COL.md}>Dentist</Th>
                  <Th className={COL.lg}>Type</Th>
                  <Th className={COL.md}>Patient</Th>
                  <Th>Status</Th>
                  <Th className={COL.sm}>Deadline</Th>
                  <Th className={COL.lg}>Submitted</Th>
                </tr>
              </thead>
              <tbody>
                {page.data.map((row) => {
                  const dentistName = row.dentist?.user
                    ? `${row.dentist.user.firstName} ${row.dentist.user.lastName}`
                    : '—';
                  return (
                    <Tr key={row.id}>
                      <Td>
                        <Link
                          href={`/admin/cases/${row.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {row.reference}
                        </Link>
                        {/* Carries the columns a phone drops. */}
                        <RowMeta className="md:hidden">
                          {dentistName} · {row.patientReference}
                        </RowMeta>
                      </Td>
                      <Td className={COL.md}>{dentistName}</Td>
                      <Td className={COL.lg}>{row.caseType?.name ?? '—'}</Td>
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
                  );
                })}
              </tbody>
            </Table>
            <Pagination meta={page.meta} onChange={(p) => patch({ page: p })} />
          </TableWrap>
        )}
      </AsyncSection>
    </div>
  );
}

export default function AdminCasesPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense>
      <AdminCasesView />
    </Suspense>
  );
}
