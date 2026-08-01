import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDataset, isCacheable } from './useDataset';
import type { LatestDataset } from '../types';

const STORAGE_KEY = 'surveillance-tracker-dataset';
const META_KEY = 'surveillance-tracker-dataset-meta';

const dataset = (over: Partial<LatestDataset> = {}): LatestDataset =>
  ({
    generatedAt: '2026-08-01T12:00:00.000Z',
    sources: [],
    ...over,
  }) as LatestDataset;

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

describe('isCacheable', () => {
  it('accepts a small payload', () => {
    expect(isCacheable('x'.repeat(1000))).toBe(true);
  });

  // Production ships ~42 MB; browsers cap localStorage near 5 MB.
  it('rejects a payload far beyond the localStorage quota', () => {
    expect(isCacheable('x'.repeat(42_000_000))).toBe(false);
  });

  it('accepts a payload exactly at the limit', () => {
    expect(isCacheable('x'.repeat(2_000_000))).toBe(true);
    expect(isCacheable('x'.repeat(2_000_001))).toBe(false);
  });
});

describe('useDataset', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue(ok(dataset()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetching', () => {
    it('loads the dataset from the API', async () => {
      const { result } = renderHook(() => useDataset());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.status).toBe('online');
      expect(result.current.dataset?.generatedAt).toBe('2026-08-01T12:00:00.000Z');
    });

    it('requests the latest dataset endpoint', async () => {
      renderHook(() => useDataset());
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toContain('/api/dataset/latest');
    });

    // Regression: `cache: 'no-store'` forced a full 42 MB re-download on every
    // page load and made the server's ETag useless.
    it('does not disable the HTTP cache', async () => {
      renderHook(() => useDataset());
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(init?.cache).not.toBe('no-store');
    });

    it('exposes the generated timestamp', async () => {
      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.lastGeneratedAt).toBe('2026-08-01T12:00:00.000Z');
    });

    it('refresh() re-requests the dataset', async () => {
      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.refresh(); });

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('caching', () => {
    it('stores a small dataset for offline use', async () => {
      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
      expect(JSON.parse(localStorage.getItem(META_KEY)!).cached).toBe(true);
    });

    // The old code stringified 42 MB on the main thread every load purely so
    // setItem could throw QuotaExceededError.
    it('does not attempt to store an oversized dataset', async () => {
      const huge = dataset({
        sources: [{ records: Array.from({ length: 60_000 }, (_, i) => ({ uid: `record-${i}-${'x'.repeat(40)}` })) }],
      } as unknown as Partial<LatestDataset>);
      globalThis.fetch = vi.fn().mockResolvedValue(ok(huge));

      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(JSON.parse(localStorage.getItem(META_KEY)!).cached).toBe(false);
      expect(result.current.status).toBe('online'); // still served fine
    });

    it('clears a stale small cache when the dataset outgrows the quota', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset({ generatedAt: 'old' })));

      const huge = dataset({
        sources: [{ records: Array.from({ length: 60_000 }, (_, i) => ({ uid: `r-${i}-${'y'.repeat(40)}` })) }],
      } as unknown as Partial<LatestDataset>);
      globalThis.fetch = vi.fn().mockResolvedValue(ok(huge));

      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Serving yesterday's data from a cache we can no longer refresh is worse
      // than having no cache.
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('survives localStorage being unavailable', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.status).toBe('online');
    });
  });

  describe('fallbacks', () => {
    it('falls back to the cached copy when the API fails', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset({ generatedAt: 'cached-copy' })));
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));

      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.status).toBe('cached');
      expect(result.current.dataset?.generatedAt).toBe('cached-copy');
    });

    it('falls back to the bundled snapshot when there is no cache', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) =>
        String(url).includes('fallback-dataset')
          ? Promise.resolve(ok(dataset({ generatedAt: 'bundled' })))
          : Promise.reject(new TypeError('offline')));

      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.status).toBe('offline');
      expect(result.current.dataset?.generatedAt).toBe('bundled');
    });

    it('reports an error when every source fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));

      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.status).toBe('error');
      expect(result.current.dataset).toBeNull();
      expect(result.current.error).toBeTruthy();
    });

    it('treats a non-2xx response as a failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('503');
    });

    it('ignores a corrupt cache entry', async () => {
      localStorage.setItem(STORAGE_KEY, 'not json{');
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));

      const { result } = renderHook(() => useDataset());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.status).toBe('error');
    });
  });
});
