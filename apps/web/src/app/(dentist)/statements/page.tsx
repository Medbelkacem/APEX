'use client';

import { useState } from 'react';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState } from '@/components/ui/data-states';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/field';
import { useApi } from '@/lib/hooks/use-api';
import { statementsApi } from '@/lib/api/invoices';
import { formatMoney, formatPeriod } from '@/lib/utils/format';

/** Years offered in the filter: this year plus the four before it. */
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function StatementsPage() {
  const [year, setYear] = useState<number | ''>('');
  const [page, setPage] = useState(1);

  const statements = useApi(
    () => statementsApi.list({ year: year || undefined, page, limit: 12 }),
    [year, page],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monthly statements</h1>
        <p className="mt-1 text-sm text-slate-500">
          A per-month summary of everything invoiced and paid on your account.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:max-w-xs">
        <Label htmlFor="year">Year</Label>
        <Select
          id="year"
          value={year}
          onChange={(e) => {
            setYear(e.target.value ? Number(e.target.value) : '');
            setPage(1);
          }}
        >
          <option value="">All years</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>

      <AsyncSection
        loading={statements.loading}
        error={statements.error}
        data={statements.data}
        isEmpty={(result) => result.data.length === 0}
        empty={
          <TableWrap>
            <EmptyState
              title="No statements yet"
              description="Statements are generated at the start of each month."
            />
          </TableWrap>
        }
      >
        {(result) => (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Period</Th>
                  <Th className="text-right">Opening</Th>
                  <Th className="text-right">Invoiced</Th>
                  <Th className="text-right">Paid</Th>
                  <Th className="text-right">Closing</Th>
                  <Th className="text-right">Statement</Th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((statement) => (
                  <Tr key={statement.id}>
                    <Td className="font-medium text-slate-900">
                      {formatPeriod(statement.periodYear, statement.periodMonth)}
                    </Td>
                    <Td className="text-right">{formatMoney(statement.openingBalance)}</Td>
                    <Td className="text-right">{formatMoney(statement.totalInvoiced)}</Td>
                    <Td className="text-right">{formatMoney(statement.totalPaid)}</Td>
                    <Td className="text-right font-medium text-slate-900">
                      {formatMoney(statement.closingBalance)}
                    </Td>
                    <Td className="text-right">
                      <a
                        href={statementsApi.pdfUrl(statement.id)}
                        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                      >
                        Download PDF
                      </a>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={result.meta} onChange={setPage} />
          </TableWrap>
        )}
      </AsyncSection>
    </div>
  );
}
