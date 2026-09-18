/**
 * Catches a specific, common mistake zod's `.email()` format check cannot:
 * a well-known provider typed with the wrong top-level domain, e.g.
 * "name@gmail.con" or "name@yahoo.cmo". Both are syntactically valid email
 * addresses, so nothing else flags them before the confirmation mail silently
 * goes nowhere.
 *
 * Deliberately narrow: only fires when the part before the TLD is an exact,
 * case-insensitive match for a known provider. A clinic's own domain (or any
 * address this list doesn't know) never matches, so this can't block a real
 * address just because it looks unusual.
 */
const KNOWN_PROVIDERS = [
  'gmail',
  'yahoo',
  'hotmail',
  'outlook',
  'icloud',
  'live',
  'aol',
  'protonmail',
] as const;

const TLD_TYPOS: Record<string, string> = {
  con: 'com',
  cmo: 'com',
  comm: 'com',
  vom: 'com',
  xom: 'com',
  ocm: 'com',
  coom: 'com',
  c0m: 'com',
  om: 'com',
};

/** The corrected address to suggest, or null if nothing looks wrong. */
export function suggestEmailCorrection(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at === -1) return null;

  const domain = email.slice(at + 1).toLowerCase();
  const dot = domain.lastIndexOf('.');
  if (dot === -1) return null;

  const provider = domain.slice(0, dot);
  const tld = domain.slice(dot + 1);
  if (!(KNOWN_PROVIDERS as readonly string[]).includes(provider)) return null;

  const fixedTld = TLD_TYPOS[tld];
  if (!fixedTld) return null;

  return `${email.slice(0, at + 1)}${provider}.${fixedTld}`;
}
