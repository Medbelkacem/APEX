'use client';

import { FormEvent, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState, Spinner } from '@/components/ui/data-states';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/lib/hooks/use-api';
import { catalogApi } from '@/lib/api/catalog';
import { pricingApi } from '@/lib/api/admin';
import { formatDate, formatMoney } from '@/lib/utils/format';

/** How the engine matched a rule, phrased so an admin can act on it. */
const BASIS_LABELS: Record<string, string> = {
  'tier+material': 'Tier + material rule',
  tier: 'Tier rule',
  material: 'Material rule',
  default: 'Case type default',
  none: 'No matching rule — price this case manually',
};

const BLANK_RULE = {
  caseTypeId: '',
  price: '',
  dentistTier: '',
  material: '',
  effectiveFrom: '',
};

type Message = { tone: 'success' | 'error'; text: string };

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminPricingPage() {
  const [filters, setFilters] = useState({ caseTypeId: '', includeInactive: false, page: 1 });

  const patch = (next: Partial<typeof filters>) =>
    // Any filter change resets to page 1 — otherwise you can land on an empty page.
    setFilters((prev) => ({ ...prev, ...next, page: next.page ?? 1 }));

  const caseTypes = useApi(() => catalogApi.caseTypes(), []);
  const rules = useApi(
    () =>
      pricingApi.list({
        caseTypeId: filters.caseTypeId || undefined,
        includeInactive: filters.includeInactive || undefined,
        page: filters.page,
        limit: 20,
      }),
    [filters.caseTypeId, filters.includeInactive, filters.page],
  );

  const [form, setForm] = useState(BLANK_RULE);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<Message>();

  // Row-level mutations report above the table so the feedback stays near the row.
  const [rowMessage, setRowMessage] = useState<Message>();
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState({ price: '', isActive: true });
  const [savingRow, setSavingRow] = useState(false);

  const [quoteForm, setQuoteForm] = useState({ caseTypeId: '', material: '', dentistTier: '' });
  const [quote, setQuote] = useState<{ price: string; currency: string; basis: string }>();
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string>();

  async function createRule(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateMessage(undefined);
    try {
      await pricingApi.create({
        caseTypeId: form.caseTypeId,
        price: form.price.trim(),
        dentistTier: form.dentistTier.trim() || null,
        material: form.material.trim() || null,
        // Omitted rather than nulled — the API defaults this to today.
        ...(form.effectiveFrom ? { effectiveFrom: form.effectiveFrom } : {}),
      });
      setForm(BLANK_RULE);
      setCreateMessage({ tone: 'success', text: 'Pricing rule added.' });
      rules.refresh();
    } catch (err) {
      setCreateMessage({ tone: 'error', text: errorText(err, 'Could not add the pricing rule') });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(id: string, price: string, isActive: boolean) {
    setRowMessage(undefined);
    setEditingId(id);
    setDraft({ price, isActive });
  }

  async function saveRow(id: string) {
    setSavingRow(true);
    setRowMessage(undefined);
    try {
      await pricingApi.update(id, { price: draft.price.trim(), isActive: draft.isActive });
      setEditingId(undefined);
      setRowMessage({ tone: 'success', text: 'Pricing rule updated.' });
      rules.refresh();
    } catch (err) {
      setRowMessage({ tone: 'error', text: errorText(err, 'Could not update the pricing rule') });
    } finally {
      setSavingRow(false);
    }
  }

  async function deleteRule(id: string, caseTypeName: string) {
    if (
      !window.confirm(
        `Delete the ${caseTypeName} pricing rule? Invoices already issued keep their price.`,
      )
    ) {
      return;
    }
    setRowMessage(undefined);
    try {
      await pricingApi.remove(id);
      setRowMessage({ tone: 'success', text: 'Pricing rule deleted.' });
      rules.refresh();
    } catch (err) {
      setRowMessage({ tone: 'error', text: errorText(err, 'Could not delete the pricing rule') });
    }
  }

  async function runQuote(event: FormEvent) {
    event.preventDefault();
    setQuoting(true);
    setQuoteError(undefined);
    setQuote(undefined);
    try {
      setQuote(
        await pricingApi.quote({
          caseTypeId: quoteForm.caseTypeId,
          material: quoteForm.material.trim() || null,
          dentistTier: quoteForm.dentistTier.trim() || null,
        }),
      );
    } catch (err) {
      setQuoteError(errorText(err, 'Could not resolve a price'));
    } finally {
      setQuoting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pricing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rules are matched most specific first: tier + material, then tier, then material, then the
          case type default.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Add a pricing rule</h2>
          <form onSubmit={createRule} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="newCaseType">Case type</Label>
                <Select
                  id="newCaseType"
                  value={form.caseTypeId}
                  onChange={(e) => setForm((f) => ({ ...f, caseTypeId: e.target.value }))}
                  required
                >
                  <option value="">Select a case type…</option>
                  {caseTypes.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="newPrice">Price</Label>
                {/* Text, not number: money stays a decimal string end to end. */}
                <Input
                  id="newPrice"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="newTier">Dentist tier</Label>
                <Input
                  id="newTier"
                  placeholder="Any tier"
                  value={form.dentistTier}
                  onChange={(e) => setForm((f) => ({ ...f, dentistTier: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="newMaterial">Material</Label>
                <Input
                  id="newMaterial"
                  placeholder="Any material"
                  value={form.material}
                  onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="newEffectiveFrom">Effective from</Label>
              <Input
                id="newEffectiveFrom"
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Leave empty to apply the rule from today.
              </p>
            </div>

            {createMessage && <Alert tone={createMessage.tone}>{createMessage.text}</Alert>}

            <Button type="submit" disabled={creating}>
              {creating && <Spinner className="mr-2" />}
              Add rule
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Price quote preview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Check what a case would be priced at before a dentist submits it.
          </p>
          <form onSubmit={runQuote} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="quoteCaseType">Case type</Label>
              <Select
                id="quoteCaseType"
                value={quoteForm.caseTypeId}
                onChange={(e) => setQuoteForm((q) => ({ ...q, caseTypeId: e.target.value }))}
                required
              >
                <option value="">Select a case type…</option>
                {caseTypes.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="quoteMaterial">Material</Label>
                <Input
                  id="quoteMaterial"
                  placeholder="Optional"
                  value={quoteForm.material}
                  onChange={(e) => setQuoteForm((q) => ({ ...q, material: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="quoteTier">Dentist tier</Label>
                <Input
                  id="quoteTier"
                  placeholder="Optional"
                  value={quoteForm.dentistTier}
                  onChange={(e) => setQuoteForm((q) => ({ ...q, dentistTier: e.target.value }))}
                />
              </div>
            </div>

            {quoteError && <Alert tone="error">{quoteError}</Alert>}

            {quote && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-2xl font-bold text-slate-900">
                  {formatMoney(quote.price, quote.currency)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Matched on: {BASIS_LABELS[quote.basis] ?? quote.basis}
                </p>
              </div>
            )}

            <Button type="submit" variant="outline" disabled={quoting}>
              {quoting && <Spinner className="mr-2" />}
              Preview price
            </Button>
          </form>
        </Card>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="filterCaseType">Case type</Label>
            <Select
              id="filterCaseType"
              value={filters.caseTypeId}
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
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                checked={filters.includeInactive}
                onChange={(e) => patch({ includeInactive: e.target.checked })}
              />
              Show inactive rules
            </label>
          </div>
        </div>
      </div>

      {rowMessage && <Alert tone={rowMessage.tone}>{rowMessage.text}</Alert>}

      <AsyncSection
        loading={rules.loading}
        error={rules.error}
        data={rules.data}
        isEmpty={(page) => page.data.length === 0}
        empty={
          <TableWrap>
            <EmptyState
              title="No pricing rules yet"
              description="Add a default rule per case type, then layer tier and material rules on top."
            />
          </TableWrap>
        }
      >
        {(page) => (
          <TableWrap>
            <Table className="md:min-w-[52rem]">
              <thead>
                <tr>
                  <Th>Case type</Th>
                  <Th className={COL.md}>Tier</Th>
                  <Th className={COL.md}>Material</Th>
                  <Th>Price</Th>
                  <Th className={COL.lg}>Effective from</Th>
                  {/* Stays put at every width: it is editable inline. */}
                  <Th>Active</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {page.data.map((rule) => {
                  const editing = editingId === rule.id;
                  const caseTypeName = rule.caseType?.name ?? '—';
                  return (
                    <Tr key={rule.id}>
                      <Td className="font-medium text-slate-900">
                        {caseTypeName}
                        {/* Carries the tier and material a phone drops. */}
                        <RowMeta className="font-normal md:hidden">
                          {rule.dentistTier ?? 'Any'} tier · {rule.material ?? 'any'} material
                        </RowMeta>
                      </Td>
                      <Td className={COL.md}>{rule.dentistTier ?? 'Any'}</Td>
                      <Td className={COL.md}>{rule.material ?? 'Any'}</Td>
                      <Td>
                        {editing ? (
                          <Input
                            aria-label="Price"
                            inputMode="decimal"
                            className="w-28"
                            value={draft.price}
                            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                          />
                        ) : (
                          formatMoney(rule.price, rule.currency)
                        )}
                      </Td>
                      <Td className={COL.lg}>{formatDate(rule.effectiveFrom)}</Td>
                      <Td>
                        {editing ? (
                          <Select
                            aria-label="Active"
                            className="w-28"
                            value={draft.isActive ? 'true' : 'false'}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, isActive: e.target.value === 'true' }))
                            }
                          >
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </Select>
                        ) : (
                          <Badge tone={rule.isActive ? 'success' : 'neutral'}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap justify-end gap-2">
                          {editing ? (
                            <>
                              <Button
                                size="sm"
                                disabled={savingRow}
                                onClick={() => saveRow(rule.id)}
                              >
                                {savingRow && <Spinner className="mr-2" />}
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={savingRow}
                                onClick={() => setEditingId(undefined)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEdit(rule.id, rule.price, rule.isActive)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteRule(rule.id, caseTypeName)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </Td>
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
