import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('web app manifest', () => {
  const m = manifest();

  it('is installable as a standalone app', () => {
    // Chrome's install criteria: a name, a 192px icon, and a display mode
    // other than 'browser'.
    expect(m.display).toBe('standalone');
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
  });

  it('ships both an any-purpose and a maskable icon', () => {
    const purposes = (m.icons ?? []).map((i) => i.purpose);

    // A single icon marked `any` gets cropped by Android's mask; one marked
    // only `maskable` looks inset everywhere else. Both are needed.
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
  });

  it('offers the icon sizes installers look for', () => {
    const sizes = (m.icons ?? []).map((i) => i.sizes);

    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('opens on the portal rather than the marketing site', () => {
    // People install this to work; landing them on the homepage every launch
    // means navigating away every launch.
    expect(m.start_url).toBe('/dashboard');
  });

  it('keeps the whole app in scope', () => {
    expect(m.scope).toBe('/');
  });

  it('uses the brand colour for the launcher and status bar', () => {
    expect(m.theme_color).toBe('#001e47');
  });

  it('points its shortcuts at real routes', () => {
    const urls = (m.shortcuts ?? []).map((s) => s.url);

    expect(urls).toEqual(['/cases/new', '/cases', '/invoices']);
    urls.forEach((url) => expect(url.startsWith('/')).toBe(true));
  });
});
