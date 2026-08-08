'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Label } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import { AsyncSection, EmptyState, Spinner } from '@/components/ui/data-states';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/lib/hooks/use-api';
import { statementsApi } from '@/lib/api/invoices';
import { dentistsApi } from '@/lib/api/admin';
import { formatDateTime, formatMoney, formatPeriod } from '@/lib/utils/format';

/** Years offered in the filter: this year plus the four before it. */
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long' });
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: MONTH_FMT.format(new Date(2000, i, 1)),
}));

/** Statements cover a closed month, so the form defaults to the previous one. */
function lastMonth(): { year: number; month: number } {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export default function AdminStatementsPage() {
  const [filters, setFilters] = useState<{ dentistId: string; year: number | ''; page: number }>({
    dentistId: '',
    year: '',
    page: 1,
  });

  const patch = (next: Partial<typeof filters>) =>
    // Any filter change resets to page 1 — otherwise you can land on an empty page.
    setFilters((prev) => ({ ...prev, ...next, page: next.page ?? 1 }));

  // A large practice list would need a typeahead; the flat list is fine at
  // laboratory scale and keeps the filter row synchronous.
  const dentists = useApi(() => dentistsApi.list({ limit: 100 }), []);
  const statements = useApi(
    () =>
      statementsApi.list({
        dentistId: filters.dentistId || undefined,
        year: filters.year || undefined,
        page: filters.page,
        limit: 20,
      }),
    [filters.dentistId, filters.year, filters.page],
  );

  const [form, setForm] = useState({ dentistId: '', ...lastMonth() });
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  /** Run a mutation with consistent busy/message handling. */
  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(undefined);
    try {
      await action();
      setMessage({ tone: 'success', text: success });
      statements.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'The action could not be completed',
      });
    } finally {
      setBusy(null);
    }
  }

  const period = formatPeriod(form.year, form.month);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy('generate');
    setFormError(undefined);
    setMessage(undefined);
    try {
      await statementsApi.generate({
        dentistId: form.dentistId,
        year: form.year,
        month: form.month,
      });
      setMessage({ tone: 'success', text: `Statement generated for ${period}.` });
      statements.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not generate the statement');
    } finally {
      setBusy(null);
    }
  }

  async function generateAll() {
    setBusy('generate-all');
    setFormError(undefined);
    setMessage(undefined);
    try {
      const result = await statementsApi.generateAll({ year: form.year, month: form.month });
      setMessage({
        tone: 'success',
        text: `${result.created} statement${result.created === 1 ? '' : 's'} generated for ${period}.`,
      });
      statements.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not generate the statements');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Statements</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monthly account summaries issued to each dentist.
        </p>
      </div>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <form
        onSubmit={generate}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">Generate statements</h2>
        <p className="mt-1 text-sm text-slate-500">
          Re-running a period replaces the stored statement for that dentist.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="formDentist">Dentist</Label>
            <Select
              id="formDentist"
              value={form.dentistId}
              onChange={(e) => setForm((f) => ({ ...f, dentistId: e.target.value }))}
            >
              <option value="">Select a dentist…</option>
              {dentists.data?.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.user.firstName} {d.user.lastName}
                  {d.clinicName ? ` — ${d.clinicName}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="formYear">Year</Label>
            <Select
              id="formYear"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="formMonth">Month</Label>
            <Select
              id="formMonth"
              value={form.month}
              onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {formError && (
          <div className="mt-4">
            <Alert tone="error">{formError}</Alert>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!form.dentistId || busy !== null}>
            {busy === 'generate' && <Spinner className="mr-2" />}
            Generate
          </Button>
          <Button type="button" variant="outline" disabled={busy !== null} onClick={generateAll}>
            {busy === 'generate-all' && <Spinner className="mr-2" />}
            Generate for all dentists
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dentist">Dentist</Label>
            <Select
              id="dentist"
              value={filters.dentistId}
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
            <Label htmlFor="year">Year</Label>
            <Select
              id="year"
              value={filters.year}
              onChange={(e) => patch({ year: e.target.value ? Number(e.target.value) : '' })}
            >
              <option value="">All years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <AsyncSection
        loading={statements.loading}
        error={statements.error}
        data={statements.data}
        isEmpty={(page) => page.data.length === 0}
        empty={
          <TableWrap>
            <EmptyState
              title="No statements match these filters"
              description="Generate a period above, or clear the dentist and year filters."
            />
          </TableWrap>
        }
      >
        {(page) => (
          <TableWrap>
            <Table className="md:min-w-[56rem]">
              <thead>
                <tr>
                  <Th>Dentist</Th>
                  <Th className={COL.sm}>Period</Th>
                  <Th className={cn(COL.lg, 'text-right')}>Opening</Th>
                  <Th className={cn(COL.lg, 'text-right')}>Invoiced</Th>
                  <Th className={cn(COL.lg, 'text-right')}>Paid</Th>
                  <Th className="text-right">Closing</Th>
                  <Th className={COL.md}>Sent</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {page.data.map((statement) => (
                  <Tr key={statement.id}>
                    <Td>
                      {statement.dentist?.user
                        ? `${statement.dentist.user.firstName} ${statement.dentist.user.lastName}`
                        : '—'}
                      {/* Carries the period, and the sent state until `md` restores it. */}
                      <RowMeta className="md:hidden">
                        <span className="sm:hidden">
                          {formatPeriod(statement.periodYear, statement.periodMonth)} ·{' '}
                        </span>
                        {statement.sentAt ? `sent ${formatDateTime(statement.sentAt)}` : 'not sent'}
                      </RowMeta>
                    </Td>
                    <Td className={cn(COL.sm, 'font-medium text-slate-900')}>
                      {formatPeriod(statement.periodYear, statement.periodMonth)}
                    </Td>
                    <Td className={cn(COL.lg, 'text-right')}>
                      {formatMoney(statement.openingBalance)}
                    </Td>
                    <Td className={cn(COL.lg, 'text-right')}>
                      {formatMoney(statement.totalInvoiced)}
                    </Td>
                    <Td className={cn(COL.lg, 'text-right')}>{formatMoney(statement.totalPaid)}</Td>
                    <Td className="text-right font-medium text-slate-900">
                      {formatMoney(statement.closingBalance)}
                    </Td>
                    <Td className={cn(COL.md, 'text-slate-500')}>
                      {statement.sentAt ? formatDateTime(statement.sentAt) : 'Not sent'}
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <a
                          href={statementsApi.pdfUrl(statement.id)}
                          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                        >
                          PDF
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === statement.id}
                          onClick={() =>
                            run(
                              statement.id,
                              () => statementsApi.send(statement.id),
                              `Statement emailed for ${formatPeriod(
                                statement.periodYear,
                                statement.periodMonth,
                              )}.`,
                            )
                          }
                        >
                          <span className="sm:hidden">Email</span>
                          <span className="hidden sm:inline">Send by email</span>
                        </Button>
                      </div>
                    </Td>
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
