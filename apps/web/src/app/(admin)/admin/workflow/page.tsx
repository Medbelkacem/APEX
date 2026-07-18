'use client';

import { FormEvent, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/field';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState, Spinner } from '@/components/ui/data-states';
import { useApi } from '@/lib/hooks/use-api';
import { catalogApi } from '@/lib/api/catalog';
import type { CaseStatus } from '@dental/shared-types';

const DEFAULT_COLOR = '#0f766e';

const BLANK_STATUS = { label: '', color: DEFAULT_COLOR, isTerminal: false };

type Message = { tone: 'success' | 'error'; text: string };

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminWorkflowPage() {
  // Inactive statuses still occupy a position in the order, so the admin view
  // always loads them — hiding them would make reordering lossy.
  const statuses = useApi(() => catalogApi.statuses(true), []);

  const [form, setForm] = useState(BLANK_STATUS);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<Message>();

  const [rowMessage, setRowMessage] = useState<Message>();
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState({ label: '', color: DEFAULT_COLOR, isTerminal: false, isActive: true });
  const [busy, setBusy] = useState(false);

  async function createStatus(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateMessage(undefined);
    try {
      await catalogApi.createStatus({
        label: form.label.trim(),
        color: form.color,
        isTerminal: form.isTerminal,
      });
      setForm(BLANK_STATUS);
      setCreateMessage({ tone: 'success', text: 'Status added at the end of the workflow.' });
      statuses.refresh();
    } catch (err) {
      setCreateMessage({ tone: 'error', text: errorText(err, 'Could not add the status') });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(status: CaseStatus) {
    setRowMessage(undefined);
    setEditingId(status.id);
    setDraft({
      label: status.label,
      color: status.color,
      isTerminal: status.isTerminal,
      isActive: status.isActive,
    });
  }

  async function saveRow(id: string) {
    setBusy(true);
    setRowMessage(undefined);
    try {
      await catalogApi.updateStatus(id, {
        label: draft.label.trim(),
        color: draft.color,
        isTerminal: draft.isTerminal,
        isActive: draft.isActive,
      });
      setEditingId(undefined);
      setRowMessage({ tone: 'success', text: 'Status updated.' });
      statuses.refresh();
    } catch (err) {
      setRowMessage({ tone: 'error', text: errorText(err, 'Could not update the status') });
    } finally {
      setBusy(false);
    }
  }

  /** The API takes the whole ordered id list, so a move is a local swap then a save. */
  async function move(index: number, direction: -1 | 1) {
    const list = statuses.data;
    if (!list) return;
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    const ids = list.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    setBusy(true);
    setRowMessage(undefined);
    try {
      await catalogApi.reorderStatuses(ids);
      statuses.refresh();
    } catch (err) {
      setRowMessage({ tone: 'error', text: errorText(err, 'Could not reorder the workflow') });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(status: CaseStatus) {
    if (!window.confirm(`Remove "${status.label}" from the workflow?`)) return;

    setBusy(true);
    setRowMessage(undefined);
    try {
      await catalogApi.removeStatus(status.id);
      setRowMessage({ tone: 'success', text: `"${status.label}" is no longer selectable.` });
      statuses.refresh();
    } catch (err) {
      // The API refuses while cases still sit in this status and names the count.
      setRowMessage({ tone: 'error', text: errorText(err, 'Could not remove the status') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Workflow</h1>
        <p className="mt-1 text-sm text-slate-500">
          The ordered stages a case moves through. Terminal stages close the case.
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Add a status</h2>
        <form onSubmit={createStatus} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="newLabel">Label</Label>
              <Input
                id="newLabel"
                placeholder="e.g. Quality check"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="newColor">Colour</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="newColor"
                  type="color"
                  className="h-11 w-16 px-1 py-1"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
                <StatusBadge label={form.label || 'Preview'} color={form.color} />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
              checked={form.isTerminal}
              onChange={(e) => setForm((f) => ({ ...f, isTerminal: e.target.checked }))}
            />
            Terminal stage — reaching it completes the case
          </label>

          {createMessage && <Alert tone={createMessage.tone}>{createMessage.text}</Alert>}

          <Button type="submit" disabled={creating}>
            {creating && <Spinner className="mr-2" />}
            Add status
          </Button>
        </form>
      </Card>

      {rowMessage && <Alert tone={rowMessage.tone}>{rowMessage.text}</Alert>}

      <AsyncSection
        loading={statuses.loading}
        error={statuses.error}
        data={statuses.data}
        isEmpty={(list) => list.length === 0}
        empty={
          <TableWrap>
            <EmptyState
              title="No workflow statuses yet"
              description="Add the first stage — cases cannot be submitted without one."
            />
          </TableWrap>
        }
      >
        {(list) => (
          <TableWrap>
            <Table className="min-w-[52rem]">
              <thead>
                <tr>
                  <Th className="w-16">Order</Th>
                  <Th>Status</Th>
                  <Th>Colour</Th>
                  <Th>Terminal</Th>
                  <Th>Active</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((status, index) => {
                  const editing = editingId === status.id;
                  return (
                    <Tr key={status.id}>
                      <Td className="text-slate-400">{index + 1}</Td>
                      <Td>
                        {editing ? (
                          <Input
                            aria-label="Label"
                            className="w-48"
                            value={draft.label}
                            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                          />
                        ) : (
                          <StatusBadge label={status.label} color={status.color} />
                        )}
                      </Td>
                      <Td>
                        {editing ? (
                          <Input
                            aria-label="Colour"
                            type="color"
                            className="h-9 w-14 px-1 py-1"
                            value={draft.color}
                            onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                          />
                        ) : (
                          <span className="flex items-center gap-2 font-mono text-xs text-slate-500">
                            <span
                              aria-hidden
                              className="h-4 w-4 rounded border border-slate-200"
                              style={{ backgroundColor: status.color }}
                            />
                            {status.color}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {editing ? (
                          <input
                            type="checkbox"
                            aria-label="Terminal"
                            className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                            checked={draft.isTerminal}
                            onChange={(e) => setDraft((d) => ({ ...d, isTerminal: e.target.checked }))}
                          />
                        ) : status.isTerminal ? (
                          <Badge tone="info">Terminal</Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </Td>
                      <Td>
                        {editing ? (
                          <input
                            type="checkbox"
                            aria-label="Active"
                            className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                            checked={draft.isActive}
                            onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                          />
                        ) : (
                          <Badge tone={status.isActive ? 'success' : 'neutral'}>
                            {status.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          {editing ? (
                            <>
                              <Button size="sm" disabled={busy} onClick={() => saveRow(status.id)}>
                                {busy && <Spinner className="mr-2" />}
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
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
                                aria-label={`Move ${status.label} up`}
                                disabled={busy || index === 0}
                                onClick={() => move(index, -1)}
                              >
                                Move up
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={`Move ${status.label} down`}
                                disabled={busy || index === list.length - 1}
                                onClick={() => move(index, 1)}
                              >
                                Move down
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => startEdit(status)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy || !status.isActive}
                                onClick={() => deactivate(status)}
                              >
                                Remove
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
          </TableWrap>
        )}
      </AsyncSection>
    </div>
  );
}
