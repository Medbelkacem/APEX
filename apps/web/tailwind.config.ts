import type { Config } from 'tailwindcss';

/**
 * Apex visual identity — see `Brand guidlines.pdf`.
 *
 * The four named brand colours are fixed by the guidelines and are exposed
 * under their own names so a component can say what it means: `navy`, `blue`,
 * `pearl` and `ink`. Nothing here is a generic 50-900 ramp round an arbitrary
 * hue — every step is a tint or shade of one of those four, mixed towards
 * white or towards black, and the named step is the guideline hex itself.
 *
 * `blue` deliberately shadows Tailwind's own blue, which is why the ramp is
 * defined right down to 950: an undefined step would fall through to stock
 * Tailwind and put a colour on the page that the brand does not own.
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
        /**
         * Super Blue — the brand's action colour: primary buttons, links,
         * active states, and the feature cards the landing page is built from.
         */
        blue: {
          DEFAULT: '#0049cc',
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
          950: '#001136',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        /**
         * Headline face — Muslone, per the guidelines. The copy of Muslone the
         * brand book embeds carries no punctuation; the full stop and hyphen
         * the design's headlines need were measured off `Apex landing page.pdf`
         * and drawn back into the subset, so "No Long-Term Commitment." reads
         * as one face throughout. Georgia is not a stand-in for Muslone but a
         * completion of it, still supplying the comma and apostrophe, and a
         * complete Muslone dropped over the woff2 retires it.
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
