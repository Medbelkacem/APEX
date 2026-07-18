'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { FieldError, Input, Label } from '@/components/ui/field';
import { Spinner } from '@/components/ui/data-states';
import { useApi } from '@/lib/hooks/use-api';
import { authApi } from '@/lib/api/auth';

export default function ProfilePage() {
  const profile = useApi(() => authApi.me(), []);

  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string>();
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string>();

  // Seed the form once the profile arrives.
  useEffect(() => {
    if (!profile.data) return;
    setForm({
      firstName: profile.data.firstName,
      lastName: profile.data.lastName,
      phone: profile.data.phone ?? '',
    });
  }, [profile.data]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage(undefined);
    try {
      await authApi.updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
      });
      setProfileMessage({ tone: 'success', text: 'Profile updated.' });
      profile.refresh();
    } catch (err) {
      setProfileMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not save your profile',
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(undefined);
    setPasswordMessage(undefined);

    if (passwords.next.length < 12) {
      setPasswordError('Your new password must be at least 12 characters');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError('The two new passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      setPasswords({ current: '', next: '', confirm: '' });
      setPasswordMessage('Password changed.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change your password');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile &amp; settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your contact details and account password.
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Contact details</h2>
        {profile.error && (
          <div className="mt-4">
            <Alert tone="error">{profile.error}</Alert>
          </div>
        )}

        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile.data?.email ?? ''} disabled readOnly />
            <p className="mt-1.5 text-xs text-slate-500">
              Contact the laboratory to change the email on your account.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

          {profileMessage && <Alert tone={profileMessage.tone}>{profileMessage.text}</Alert>}

          <Button type="submit" disabled={savingProfile || profile.loading}>
            {savingProfile && <Spinner className="mr-2" />}
            Save changes
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
        <form onSubmit={changePassword} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={passwords.current}
              onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={passwords.next}
              onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">
              At least 12 characters, with upper and lower case, a number, and a symbol.
            </p>
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              required
            />
            <FieldError>{passwordError}</FieldError>
          </div>

          {passwordMessage && <Alert tone="success">{passwordMessage}</Alert>}

          <Button type="submit" disabled={savingPassword}>
            {savingPassword && <Spinner className="mr-2" />}
            Change password
          </Button>
        </form>
      </Card>
    </div>
  );
}
