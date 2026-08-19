import type { Config } from 'tailwindcss';

/**
 * Apex visual identity — see `Brand guidlines.pdf`.
 *
 * The four named brand colours are fixed by the guidelines and are exposed
 * under their own names so a component can say what it means. `brand` is the
 * tint/shade ramp built around Super Blue, which is what the interactive
 * surfaces (buttons, links, active states) throughout the portal are keyed to.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /** Shocking Black — the guidelines' text black. */
        ink: '#111111',
        /** Oxford Navy — dark surfaces, footer, headings on light. */
        navy: {
          DEFAULT: '#001e47',
          50: '#e8edf5',
          100: '#c5d2e5',
          200: '#8ea6c8',
          300: '#5679ab',
          400: '#2b4f80',
          500: '#123163',
          600: '#052653',
          700: '#001e47',
          800: '#001635',
          900: '#000e23',
        },
        /** Shiny Pearl — the warm off-white the brand uses instead of paper white. */
        pearl: {
          DEFAULT: '#fff7e6',
          50: '#fffdf7',
          100: '#fff7e6',
          200: '#ffeec9',
        },
        /** Super Blue #0049cc at 600 — the brand's action colour. */
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#b3ccff',
          300: '#80a9ff',
          400: '#4d80f5',
          500: '#1f5ce0',
          600: '#0049cc',
          700: '#003ba6',
          800: '#002d80',
          900: '#001f5c',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        /**
         * Headline face. The brand font is Muslone, which is licensed and not
         * web-distributable; Fraunces is the closest free stand-in and holds
         * the same bold, condensed, high-contrast wedge-serif voice. Dropping
         * Muslone into `--font-display` swaps it everywhere with no other edit.
         */
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        /** The soft drop the mockup puts under every blue feature pill. */
        pill: '0 10px 24px -12px rgba(0, 30, 71, 0.55)',
      },
    },
  },
  plugins: [],
};

export default config;
