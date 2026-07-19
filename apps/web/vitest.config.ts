import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Vitest rather than Jest: the web app has no Babel/SWC test pipeline of its
 * own, and Vitest reuses the same esbuild transform Next already relies on, so
 * TSX and the `@/` alias work without a second toolchain to keep in sync.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the `paths` entry in tsconfig.json.
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
