/** A tiny deny-list of the most common passwords. Extend as needed. */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'letmein',
  'welcome1',
  'admin123',
  'changeme',
  'iloveyou',
]);

export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordCheckResult {
  valid: boolean;
  errors: string[];
}

/**
 * Enforces the DRS password policy: minimum length, mixed character classes,
 * and rejection of well-known common passwords.
 */
export function checkPasswordPolicy(password: string): PasswordCheckResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common; choose a stronger one');
  }

  return { valid: errors.length === 0, errors };
}
