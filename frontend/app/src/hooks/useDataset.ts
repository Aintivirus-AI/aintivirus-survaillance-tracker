import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DatasetStatus, LatestDataset } from '../types';

const STORAGE_KEY = 'surveillance-tracker-dataset';
const FALLBACK_URL = '/fallback-dataset.json';

/**
 * Base URL for the engine API.
 *
 * - Explicit override via VITE_API_BASE_URL always wins (useful for split hosting
 *   or preview environments).
 * - In production builds we default to empty — the frontend is served same-origin
 *   as the API via nginx `/api/` → :3000, so relative URLs just work.
 * - In dev (`vite`, `npm run dev`) we default to http://localhost:3000 so the
 *   frontend can hit the engine running alongside it.
 */
const API_BASE = ((): string => {
  const explicit = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (typeof explicit === 'string') return explicit;
  return import.meta.env.DEV ? 'http://localhost:3000' : '';
})();

interface DatasetState {
  data: LatestDataset | null;
  status: DatasetStatus;
  loading: boolean;
  error?: string;
}

interface UseDatasetResult {
  dataset: LatestDataset | null;
  status: DatasetStatus;
  isLoading: boolean;
  error?: string;
  lastGeneratedAt?: string;
  refresh: () => Promise<void>;
}

function getStoredDataset(): LatestDataset | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as LatestDataset;
  } catch (error) {
    console.warn('Failed to parse cached dataset', error);
    return null;
  }
}

function storeDataset(dataset: LatestDataset): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
  } catch (error) {
    console.warn('Unable to persist dataset cache', error);
  }
}

async function fetchFallbackDataset(): Promise<LatestDataset | null> {
  try {
    const response = await fetch(FALLBACK_URL, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as LatestDataset;
  } catch (error) {
    console.warn('Fallback dataset unavailable', error);
    return null;
  }
}

export function useDataset(): UseDatasetResult {
  const [state, setState] = useState<DatasetState>({
    data: null,
    status: 'loading',
    loading: true,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    try {
      const response = await fetch(`${API_BASE}/api/dataset/latest`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const dataset = (await response.json()) as LatestDataset;
      storeDataset(dataset);

      setState({
        data: dataset,
        status: 'online',
        loading: false,
      });
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load dataset';
      console.warn('Live dataset unavailable, falling back', error);
      const cached = getStoredDataset();
      if (cached) {
        setState({
          data: cached,
          status: 'cached',
          loading: false,
          error: message,
        });
        return;
      }

      const fallback = await fetchFallbackDataset();
      if (fallback) {
        setState({
          data: fallback,
          status: 'offline',
          loading: false,
          error: message,
        });
        return;
      }

      setState({
        data: null,
        status: 'error',
        loading: false,
        error: message,
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lastGeneratedAt = useMemo(
    () => state.data?.generatedAt ?? undefined,
    [state.data],
  );

  return {
    dataset: state.data,
    status: state.status,
    isLoading: state.loading,
    error: state.error,
    lastGeneratedAt,
    refresh,
  };
}


