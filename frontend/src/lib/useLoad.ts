import { useCallback, useEffect, useState } from 'react';
import { type ApiError, toApiError } from '../api/client';

export interface LoadResult<Data> {
  /** The latest data, or undefined before the first load finishes. */
  data: Data | undefined;
  /** Set when the latest load failed. */
  error: ApiError | undefined;
  /** True while a load is in flight. */
  loading: boolean;
  /** Runs the load again, for example after saving something. */
  reload: () => void;
}

/**
 * Loads data when the screen opens and again whenever a value in `deps` changes.
 * Keeps the previous data on screen while a newer load is running, so lists do not flicker.
 * If two loads overlap, only the newest one is allowed to update the screen.
 */
export function useLoad<Data>(load: () => Promise<Data>, deps: readonly unknown[]): LoadResult<Data> {
  const [data, setData] = useState<Data | undefined>(undefined);
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(undefined);
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setError(toApiError(failure));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // `load` is recreated on every render, so the listed deps decide when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { data, error, loading, reload };
}

/** Returns `value`, but only after it has stopped changing for `delayMs`. Used for search boxes. */
export function useDebounced<Value>(value: Value, delayMs: number): Value {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
