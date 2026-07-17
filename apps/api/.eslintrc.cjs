module.exports = {
  extends: ['@dental/eslint-config'],
  parserOptions: {
    project: null,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', 'jest.config.js', '.eslintrc.cjs'],
};
