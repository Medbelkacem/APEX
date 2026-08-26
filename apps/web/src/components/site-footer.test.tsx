/**
 * The footer is the site's other unattended surface for invented data: three
 * social circles that the design draws filled in, and no real profiles behind
 * any of them yet. An icon that links to a placeholder profile is worse than an
 * absent icon, so only configured channels are drawn — that is what is pinned
 * here, alongside the two legal lines the design fixes word for word.
 *
 * The environment is read when the module is evaluated, so each case sets it
 * and re-imports.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The footer's nav is the shared one, and which five entries it renders
 * depends on the route — anchors on the landing page, routes elsewhere. The
 * pathname is the only thing these tests need from Next's router.
 */
let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const ENV_KEYS = ['LAB_PHONE', 'LAB_INSTAGRAM_URL', 'LAB_FACEBOOK_URL'] as const;

let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

async function renderFooter(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  vi.resetModules();
  const { SiteFooter } = await import('./site-footer');
  return render(<SiteFooter />);
}

beforeEach(() => {
  pathname = '/';
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('SiteFooter socials', () => {
  it('draws no social circles until the laboratory has configured one', async () => {
    await renderFooter({});

    for (const label of ['Instagram', 'Phone', 'Facebook']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
  });

  it('draws only the channels that are set', async () => {
    await renderFooter({ LAB_INSTAGRAM_URL: 'https://instagram.com/example' });

    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
      'href',
      'https://instagram.com/example',
    );
    expect(screen.queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Phone' })).not.toBeInTheDocument();
  });

  it('treats a variable set to blank as unset', async () => {
    await renderFooter({ LAB_FACEBOOK_URL: '   ' });

    expect(screen.queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument();
  });
});

describe('SiteFooter copy', () => {
  it('signs off with the two legal lines the design fixes', async () => {
    await renderFooter({});
    const year = new Date().getFullYear();

    expect(screen.getByText(`© ${year} Apex Digital Lab. All rights reserved.`)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Focused-SKU Digital Lab Partner exclusively for independent US general dentists.',
      ),
    ).toBeInTheDocument();
  });

  it('repeats the five entries the design prints, casing included', async () => {
    await renderFooter({});
    const nav = screen.getByRole('navigation', { name: 'Footer' });

    expect(
      [...nav.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Main', '/#main'],
      ['problems', '/#problems'],
      ['About', '/#about'],
      ['Services', '/#services'],
      ['contact', '/#contact'],
    ]);
  });

  it('carries the DRS\u2019s five pages once you are off the landing page', async () => {
    // The design's anchors cannot work here: /contact has no #problems to
    // reach, and About, Services and How to send a case would be unreachable.
    pathname = '/contact';
    await renderFooter({});
    const nav = screen.getByRole('navigation', { name: 'Footer' });

    expect(
      [...nav.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Home', '/'],
      ['About', '/about'],
      ['Services', '/services'],
      ['How to send a case', '/how-to-send-a-case'],
      ['Contact', '/contact'],
    ]);
  });

  it('promises nothing the laboratory has not supplied', async () => {
    await renderFooter({});

    // No address, no hours, no links to policies that do not exist yet.
    expect(screen.queryByText(/privacy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/terms/i)).not.toBeInTheDocument();
  });
});
