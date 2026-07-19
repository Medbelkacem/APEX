/**
 * Presentation helpers. These are worth pinning because money and dates reach
 * the user through them, and a silent change here misstates an invoice rather
 * than throwing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPeriod,
  timeAgo,
} from './format';

describe('formatMoney', () => {
  it('defaults to USD, the platform currency', () => {
    expect(formatMoney('100.00')).toBe('$100.00');
  });

  it('honours an explicit currency, which invoices inherit from their pricing rule', () => {
    // An invoice carries its own currency; the formatter must not assume USD.
    expect(formatMoney('100.00', 'EUR')).toBe('€100.00');
  });

  it('accepts the decimal strings the API sends', () => {
    // Money crosses the wire as a string precisely to avoid float drift.
    expect(formatMoney('1234.56')).toBe('$1,234.56');
  });

  it('accepts a number', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });

  it('renders zero rather than an em dash', () => {
    expect(formatMoney('0.00')).toBe('$0.00');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('treats a missing amount as zero', () => {
    expect(formatMoney(null)).toBe('$0.00');
    expect(formatMoney(undefined)).toBe('$0.00');
  });

  it('falls back to an em dash for a value that is not a number', () => {
    expect(formatMoney('not-money')).toBe('—');
  });

  it('always shows two decimal places', () => {
    expect(formatMoney('5')).toBe('$5.00');
    expect(formatMoney('5.5')).toBe('$5.50');
  });
});

describe('formatDate', () => {
  it('renders an ISO date in the platform format', () => {
    expect(formatDate('2026-03-05')).toBe('05 Mar 2026');
  });

  it('accepts a Date', () => {
    expect(formatDate(new Date(Date.UTC(2026, 2, 5)))).toBe('05 Mar 2026');
  });

  it('returns an em dash for a missing value', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('returns an em dash rather than "Invalid Date"', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('includes the time', () => {
    expect(formatDateTime('2026-03-05T14:30:00Z')).toMatch(/05 Mar 2026/);
  });

  it('returns an em dash for a missing value', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('returns an em dash for an unparseable value', () => {
    expect(formatDateTime('nonsense')).toBe('—');
  });
});

describe('formatBytes', () => {
  it('reports whole bytes without a decimal', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('scales to kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('scales to megabytes, the usual size of an STL', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('scales to gigabytes', () => {
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });

  it('does not run past its largest unit', () => {
    expect(formatBytes(1024 ** 5)).toMatch(/GB$/);
  });

  it('treats missing, zero, and negative sizes as empty', () => {
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
  });

  it('accepts a numeric string', () => {
    expect(formatBytes('2048')).toBe('2.0 KB');
  });
});

describe('timeAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Freezes the clock so relative output is deterministic. */
  function at(now: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
  }

  it('collapses anything under a minute to "just now"', () => {
    at('2026-03-05T12:00:30Z');
    expect(timeAgo('2026-03-05T12:00:00Z')).toBe('just now');
  });

  it('reports minutes', () => {
    at('2026-03-05T12:05:00Z');
    expect(timeAgo('2026-03-05T12:00:00Z')).toBe('5 minutes ago');
  });

  it('reports hours', () => {
    at('2026-03-05T15:00:00Z');
    expect(timeAgo('2026-03-05T12:00:00Z')).toBe('3 hours ago');
  });

  it('reports days', () => {
    at('2026-03-08T12:00:00Z');
    expect(timeAgo('2026-03-05T12:00:00Z')).toBe('3 days ago');
  });

  it('returns an em dash for a missing value', () => {
    expect(timeAgo(null)).toBe('—');
  });
});

describe('formatPeriod', () => {
  it('labels a statement period', () => {
    expect(formatPeriod(2026, 7)).toBe('July 2026');
  });

  it('handles the first and last month without slipping a year', () => {
    expect(formatPeriod(2026, 1)).toBe('January 2026');
    expect(formatPeriod(2026, 12)).toBe('December 2026');
  });
});
