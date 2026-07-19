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
    name: 'Dental Lab — Case Management',
    short_name: 'Dental Lab',
    description:
      'Submit dental cases, upload STL scans, track production, and manage invoices.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#0f766e',
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
