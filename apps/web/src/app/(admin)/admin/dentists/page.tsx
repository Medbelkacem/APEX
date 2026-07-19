'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input, Label, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState, Spinner } from '@/components/ui/data-states';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/lib/hooks/use-api';
import { dentistsApi } from '@/lib/api/admin';
import { formatDate } from '@/lib/utils/format';
import { USER_STATUS_TONES, userStatusLabel } from '@/lib/utils/user-status';

interface DentistListQuery {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const EMPTY_FORM = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  clinicName: '',
  clinicAddress: '',
  billingAddress: '',
  tier: '',
  notes: '',
};

/** Optional text fields go to the API as null, not '', so they stay unset. */
const orNull = (value: string) => value.trim() || null;

export default function AdminDentistsPage() {
  const [filters, setFilters] = useState<DentistListQuery>({
    status: '',
    search: '',
    page: 1,
    limit: 20,
  });

  const patch = (next: Partial<DentistListQuery>) =>
    // Any filter change resets to page 1 — otherwise you can land on an empty page.
    setFilters((prev) => ({ ...prev, ...next, page: next.page ?? 1 }));

  const dentists = useApi(
    () => dentistsApi.list(filters),
    [filters.status, filters.search, filters.page],
  );

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function createDentist(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(undefined);
    setNotice(undefined);
    try {
      await dentistsApi.create({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: orNull(form.phone),
        clinicName: orNull(form.clinicName),
        clinicAddress: orNull(form.clinicAddress),
        billingAddress: orNull(form.billingAddress),
        tier: orNull(form.tier),
        notes: orNull(form.notes),
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setNotice(`Invitation sent to ${form.email.trim()}.`);
      dentists.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the dentist');
    } finally {
      setCreating(false);
    }
  }

  const [reviewing, setReviewing] = useState<string>();

  async function approve(id: string) {
    setReviewing(id);
    setNotice(undefined);
    setCreateError(undefined);
    try {
      const dentist = await dentistsApi.approve(id);
      setNotice(`${dentist.user.email} can now sign in — we've emailed them.`);
      dentists.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not approve this registration');
    } finally {
      setReviewing(undefined);
    }
  }

  async function reject(id: string) {
    // Declining sends the applicant an email, so it is worth a deliberate
    // confirmation rather than a single misplaced click.
    const reason = window.prompt(
      'Decline this registration? You can add a short reason for the applicant (optional).',
      '',
    );
    if (reason === null) return;

    setReviewing(id);
    setNotice(undefined);
    setCreateError(undefined);
    try {
      const dentist = await dentistsApi.reject(id, reason.trim() || null);
      setNotice(`Registration for ${dentist.user.email} was declined.`);
      dentists.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not decline this registration');
    } finally {
      setReviewing(undefined);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dentists</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage clinic accounts, invitations, and access to the portal.
          </p>
        </div>
        <Button
          variant={showCreate ? 'outline' : 'primary'}
          onClick={() => setShowCreate((open) => !open)}
        >
          {showCreate ? 'Cancel' : 'Add dentist'}
        </Button>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}

      {showCreate && (
        <form
          onSubmit={createDentist}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">New dentist</h2>
          <p className="mt-1 text-sm text-slate-500">
            The account is created as invited; the dentist sets their own password from the
            invitation email.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="tier">Pricing tier</Label>
              <Input
                id="tier"
                value={form.tier}
                onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="clinicName">Clinic name</Label>
              <Input
                id="clinicName"
                value={form.clinicName}
                onChange={(e) => setForm((f) => ({ ...f, clinicName: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="clinicAddress">Clinic address</Label>
              <Textarea
                id="clinicAddress"
                value={form.clinicAddress}
                onChange={(e) => setForm((f) => ({ ...f, clinicAddress: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="billingAddress">Billing address</Label>
              <Textarea
                id="billingAddress"
                value={form.billingAddress}
                onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Internal notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Only visible to laboratory staff"
              />
            </div>
          </div>

          {createError && (
            <div className="mt-4">
              <Alert tone="error">{createError}</Alert>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <Button type="submit" disabled={creating}>
              {creating && <Spinner className="mr-2" />}
              Create dentist
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Name, email, clinic…"
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
              <option value="pending">Awaiting approval</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="invited">Invited</option>
            </Select>
          </div>
        </div>
      </div>

      <AsyncSection
        loading={dentists.loading}
        error={dentists.error}
        data={dentists.data}
        isEmpty={(page) => page.data.length === 0}
        empty={
          <TableWrap>
            <EmptyState
              title="No dentists match these filters"
              description="Try clearing the search or status filter."
            />
          </TableWrap>
        }
      >
        {(page) => (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Clinic</Th>
                  <Th>Tier</Th>
                  <Th>Status</Th>
                  <Th>Added</Th>
                  <Th>Review</Th>
                </tr>
              </thead>
              <tbody>
                {page.data.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <Link
                        href={`/admin/dentists/${row.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {row.user.firstName} {row.user.lastName}
                      </Link>
                    </Td>
                    <Td>{row.user.email}</Td>
                    <Td>{row.clinicName ?? '—'}</Td>
                    <Td>{row.tier ?? '—'}</Td>
                    <Td>
                      <Badge tone={USER_STATUS_TONES[row.user.status]}>
                        {userStatusLabel(row.user.status, Boolean(row.user.emailVerifiedAt))}
                      </Badge>
                    </Td>
                    <Td>{formatDate(row.createdAt)}</Td>
                    <Td>
                      {row.user.status === 'pending' && row.user.emailVerifiedAt ? (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            disabled={reviewing === row.id}
                            onClick={() => void approve(row.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={reviewing === row.id}
                            onClick={() => void reject(row.id)}
                          >
                            Decline
                          </Button>
                        </div>
                      ) : row.user.status === 'pending' ? (
                        // Nothing for an admin to do yet — the applicant still
                        // has to open the link before there is anything to trust.
                        <span className="text-sm text-slate-400">Waiting on applicant</span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
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
