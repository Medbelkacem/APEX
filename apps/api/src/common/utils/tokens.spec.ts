import { generateToken, hashToken } from './tokens';

describe('tokens', () => {
  it('generates a raw token whose hash matches hashToken', () => {
    const { raw, hash } = generateToken();
    expect(raw.length).toBeGreaterThan(20);
    expect(hash).toBe(hashToken(raw));
  });

  it('produces different tokens each call', () => {
    expect(generateToken().raw).not.toBe(generateToken().raw);
  });

  it('hashToken is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});
