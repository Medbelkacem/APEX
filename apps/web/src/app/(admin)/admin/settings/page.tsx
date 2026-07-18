'use client';

import { FormEvent, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/field';
import { AsyncSection, Skeleton, Spinner } from '@/components/ui/data-states';
import { useApi } from '@/lib/hooks/use-api';
import { settingsApi, type PlatformSettingRow } from '@/lib/api/admin';
import { formatDateTime } from '@/lib/utils/format';

/** Settings are a flat key/value store; the prefix before the dot drives grouping. */
const GROUPS = [
  {
    prefix: 'brand',
    title: 'Laboratory identity',
    description: 'Appears on invoices, statements, and outgoing email.',
  },
  {
    prefix: 'billing',
    title: 'Billing',
    description: 'Applied when new invoices are generated. Existing invoices keep their own values.',
  },
  {
    prefix: 'stripe',
    title: 'Stripe payments',
    description: 'Credentials for online card payments. Secrets are encrypted at rest.',
  },
  {
    prefix: 'smtp',
    title: 'Email delivery',
    description: 'Outbound mail server used for notifications and invoices.',
  },
];

const prefixOf = (key: string) => key.split('.')[0];

/** `billing.payment_terms_days` → "Payment terms days". */
function labelFor(key: string): string {
  const name = key.slice(key.indexOf('.') + 1).replace(/_/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function AdminSettingsPage() {
  const settings = useApi(() => settingsApi.list(), []);

  // Only keys the admin actually touched live here, so an untouched secret is
  // never sent back — the API redacts secrets and would overwrite them with the
  // placeholder we displayed.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  const valueFor = (row: PlatformSettingRow) => {
    if (row.key in edits) return edits[row.key];
    return row.isSecret ? '' : (row.value ?? '');
  };

  /** A blank secret means "leave unchanged", so it never counts as a change. */
  const pending = (settings.data ?? []).filter(
    (row) => row.key in edits && !(row.isSecret && edits[row.key] === ''),
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    try {
      await settingsApi.update(
        // Clearing a non-secret field unsets it rather than storing an empty string.
        pending.map((row) => ({ key: row.key, value: edits[row.key] || null })),
      );
      setEdits({});
      setMessage({ tone: 'success', text: 'Settings saved.' });
      settings.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not save the settings',
      });
    } finally {
      setSaving(false);
    }
  }

  function renderField(row: PlatformSettingRow) {
    return (
      <div key={row.key}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={row.key} className="mb-0">
            {labelFor(row.key)}
          </Label>
          {row.isSecret && (
            <Badge tone={row.isSet ? 'success' : 'neutral'}>{row.isSet ? 'Set' : 'Not set'}</Badge>
          )}
        </div>
        <Input
          id={row.key}
          className="mt-1.5"
          type={row.isSecret ? 'password' : 'text'}
          autoComplete={row.isSecret ? 'new-password' : 'off'}
          value={valueFor(row)}
          placeholder={
            row.isSecret
              ? row.isSet
                ? 'Leave blank to keep the current value'
                : 'Not set'
              : undefined
          }
          onChange={(e) => setEdits((prev) => ({ ...prev, [row.key]: e.target.value }))}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          <code className="text-slate-400">{row.key}</code>
          {row.updatedAt && ` · updated ${formatDateTime(row.updatedAt)}`}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Global configuration for billing, branding, payments, and email.
        </p>
      </div>

      <AsyncSection
        loading={settings.loading}
        error={settings.error}
        data={settings.data}
        skeleton={<Skeleton className="h-64 w-full" />}
      >
        {(rows) => {
          // Anything with an unrecognised prefix still gets a home, so no key
          // silently becomes uneditable when the API grows one.
          const other = rows.filter((row) => !GROUPS.some((g) => g.prefix === prefixOf(row.key)));

          return (
            <form onSubmit={save} className="space-y-6">
              {GROUPS.map((group) => {
                const groupRows = rows.filter((row) => prefixOf(row.key) === group.prefix);
                if (groupRows.length === 0) return null;

                return (
                  <Card key={group.prefix}>
                    <h2 className="text-lg font-semibold text-slate-900">{group.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {groupRows.map(renderField)}
                    </div>
                  </Card>
                );
              })}

              {other.length > 0 && (
                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Other</h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">{other.map(renderField)}</div>
                </Card>
              )}

              {message && <Alert tone={message.tone}>{message.text}</Alert>}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving || pending.length === 0}>
                  {saving && <Spinner className="mr-2" />}
                  Save changes
                </Button>
                {pending.length > 0 && (
                  <p className="text-sm text-slate-500">
                    {pending.length} setting{pending.length === 1 ? '' : 's'} edited
                  </p>
                )}
              </div>
            </form>
          );
        }}
      </AsyncSection>
    </div>
  );
}
