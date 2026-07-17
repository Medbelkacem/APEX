import { createHash, randomBytes } from 'crypto';

/** Generate a URL-safe random token and its SHA-256 hash (store the hash only). */
export function generateToken(bytes = 32): { raw: string; hash: string } {
  const raw = randomBytes(bytes).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
