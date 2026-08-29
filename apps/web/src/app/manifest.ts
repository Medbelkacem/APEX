import type { MetadataRoute } from 'next';

/**
 * Web app manifest, served by Next at /manifest.webmanifest.
 *
 * `start_url` is /dashboard rather than /: someone installs this to work, and
 * an installed app that opens on the marketing homepage makes them navigate
 * every time. Unauthenticated visitors are redirected to /login by middleware,
 * so the launcher entry behaves correctly either way.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Apex — Case Management',
    short_name: 'Apex',
    description:
      'Submit dental cases, upload STL scans, track production, and manage invoices.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    // Shiny Pearl and Oxford Navy — the splash screen an install paints
    // before the first frame renders.
    background_color: '#fff7e6',
    theme_color: '#001e47',
    categories: ['medical', 'productivity', 'business'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate entry: Android crops to its own shape, and an `any` icon put
      // through that mask loses its edges.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Submit a case', short_name: 'New case', url: '/cases/new' },
      { name: 'My cases', short_name: 'Cases', url: '/cases' },
      { name: 'Invoices', short_name: 'Invoices', url: '/invoices' },
    ],
  };
}
