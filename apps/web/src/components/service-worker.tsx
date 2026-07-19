'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker.
 *
 * Production only. In development Next serves modules that change on every
 * edit, and a worker sitting in front of them serves yesterday's build back —
 * the resulting "why is my change not showing" is worse than having no offline
 * shell while developing.
 *
 * Renders nothing; it exists for the effect.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Registration competes with the page's own requests, so it waits for load.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A failed registration costs the offline shell and nothing else, so it
        // must never surface to the user as an error.
      });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
