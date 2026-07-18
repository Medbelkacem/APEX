'use client';

import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  /** Re-run the fetcher, e.g. after a mutation. */
  refresh: () => void;
}

/**
 * Minimal data-fetching hook for the authenticated portal: runs `fetcher` when
 * its dependencies change and exposes loading/error/refresh. Results from a
 * superseded request are discarded, so fast filter changes cannot render stale
 * data over newer data.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: DependencyList = []): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // Keep the latest fetcher without making it a dependency — callers routinely
  // pass an inline closure, which would otherwise re-run this on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);

    fetcherRef
      .current()
      .then((result) => {
        if (!active) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, refresh };
}
