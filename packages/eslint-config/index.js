/**
 * Shared ESLint config for TypeScript packages in the monorepo.
 * Consumed via `extends: ['@dental/eslint-config']`.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'eslint-config-prettier',
  ],
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.config.js', '*.config.cjs'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    'no-console': 'off',
  },
};
