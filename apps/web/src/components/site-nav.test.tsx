/**
 * The navigation resolves a conflict between the two source documents, so the
 * rule it encodes is worth pinning: the approved design draws five anchors
 * into the landing page's sections, and the DRS requires five navigable public
 * pages with consistent navigation across the surface. Anchors everywhere
 * would make three of those pages unreachable; routes everywhere would not be
 * the header that was approved.
 *
 * Each page therefore carries the navigation that can work on it.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LANDING_NAV, PAGE_NAV, SiteNavLinks } from './site-nav';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

/** Render at `route` and read back what the nav offers, leaving no DOM behind. */
function links(route = '/') {
  pathname = route;
  const { unmount } = render(<SiteNavLinks ariaLabel="Primary" />);
  const found = [
    ...screen.getByRole('navigation', { name: 'Primary' }).querySelectorAll('a'),
  ].map((a) => [a.textContent, a.getAttribute('href')] as const);
  unmount();
  return found;
}

beforeEach(() => {
  pathname = '/';
});

describe('SiteNavLinks', () => {
  it('draws the design’s anchors on the landing page', () => {
    expect(links()).toEqual(LANDING_NAV.map((i) => [i.label, i.href]));
  });

  it('draws the DRS’s routes on every other public page', () => {
    for (const route of ['/about', '/services', '/how-to-send-a-case', '/contact']) {
      expect(links(route)).toEqual(PAGE_NAV.map((i) => [i.label, i.href]));
    }
  });

  it('keeps the design’s casing, which is not title case throughout', () => {
    // Two of the five are deliberately lower case in the mockup.
    expect(LANDING_NAV.map((i) => i.label)).toEqual([
      'Main',
      'problems',
      'About',
      'Services',
      'contact',
    ]);
  });

  it('anchors are absolute, so they still resolve from an inner page', () => {
    // `#about` would hunt for an element that is not on /contact.
    for (const item of LANDING_NAV) expect(item.href.startsWith('/#')).toBe(true);
  });

  it('reaches every public page the DRS deliverables list requires', () => {
    expect(PAGE_NAV.map((i) => i.href)).toEqual([
      '/',
      '/about',
      '/services',
      '/how-to-send-a-case',
      '/contact',
    ]);
  });
});
