import { checkPasswordPolicy, PASSWORD_MIN_LENGTH } from './password-policy';

describe('checkPasswordPolicy', () => {
  it('accepts a strong password', () => {
    expect(checkPasswordPolicy('Str0ngPass!').valid).toBe(true);
  });

  it('rejects passwords shorter than the minimum length', () => {
    const res = checkPasswordPolicy('Ab1');
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toContain(`${PASSWORD_MIN_LENGTH}`);
  });

  it('requires mixed character classes', () => {
    expect(checkPasswordPolicy('alllowercase1').valid).toBe(false);
    expect(checkPasswordPolicy('ALLUPPERCASE1').valid).toBe(false);
    expect(checkPasswordPolicy('NoNumbersHere').valid).toBe(false);
  });

  it('rejects common passwords', () => {
    expect(checkPasswordPolicy('password123').valid).toBe(false);
  });
});
