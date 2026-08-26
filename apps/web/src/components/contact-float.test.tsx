/**
 * The floating contact button is the one place on the marketing site where a
 * missing value would be invisible and actively harmful: a green call button
 * that dials nobody looks exactly like one that works. These tests pin the rule
 * that it renders only when the laboratory has configured a channel.
 *
 * The environment is read when the component runs, so each case sets it and
 * re-imports rather than relying on whatever the process was started with.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = ['LAB_WHATSAPP', 'LAB_PHONE'] as const;

let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

async function renderFloat(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  vi.resetModules();
  const { ContactFloat } = await import('./contact-float');
  return render(<ContactFloat />);
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('ContactFloat', () => {
  it('renders nothing when the laboratory has configured no channel', async () => {
    const { container } = await renderFloat({});

    expect(container).toBeEmptyDOMElement();
  });

  it('prefers WhatsApp, and strips the number down to digits', async () => {
    await renderFloat({ LAB_WHATSAPP: '+1 (555) 010-9999', LAB_PHONE: '+1 555 010 1111' });

    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/15550109999');
    // An outbound target must not hand the opened tab a handle back to us.
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('falls back to dialling the laboratory when there is no WhatsApp number', async () => {
    await renderFloat({ LAB_PHONE: '+1 555 010 1111' });

    expect(screen.getByRole('link', { name: /call the lab/i })).toHaveAttribute(
      'href',
      'tel:+15550101111',
    );
  });

  it('meets the minimum tap target the DRS asks for', async () => {
    await renderFloat({ LAB_WHATSAPP: '15550109999' });

    // h-14/w-14 is 56px — the floor for a touch target.
    expect(screen.getByRole('link')).toHaveClass('h-14', 'w-14');
  });
});
