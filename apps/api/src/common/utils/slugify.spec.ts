import { formatSequence, slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('In Production')).toBe('in-production');
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify('Inlay / Onlay!!')).toBe('inlay-onlay');
  });

  it('trims leading/trailing separators', () => {
    expect(slugify('  Crown  ')).toBe('crown');
  });
});

describe('formatSequence', () => {
  it('zero-pads sequence numbers with a prefix and year', () => {
    expect(formatSequence('CASE', 2026, 1)).toBe('CASE-2026-0001');
    expect(formatSequence('INV', 2026, 123)).toBe('INV-2026-0123');
  });
});
