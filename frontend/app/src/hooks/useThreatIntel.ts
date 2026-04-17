import { useEffect, useRef, useState } from 'react';

/**
 * Hooks for the backend live threat-intel endpoints (CISA KEV + HaveIBeenPwned
 * + stalkerware IOC). Each hook fetches once on mount with a small
 * retry-after-error cooldown so a single upstream blip doesn't spam the API.
 *
 * The backend already caches these responses for us (1h KEV, 6h breaches, 24h
 * stalkerware) so we don't worry about polling cadence client-side.
 */

const API_BASE = ((): string => {
  const explicit = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (typeof explicit === 'string') return explicit;
  return import.meta.env.DEV ? 'http://localhost:3000' : '';
})();

export interface KevEntry {
  cveId: string;
  vendor: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  knownRansomwareCampaignUse: boolean;
}

export interface KevSnapshot {
  totalCount: number;
  latest: KevEntry[];
  fetchedAt: string;
  catalogVersion: string | null;
  source: string;
  fromCache: boolean;
}

export interface BreachEntry {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  pwnCount: number;
  isVerified: boolean;
  isSensitive: boolean;
  dataClasses: string[];
}

export interface BreachSnapshot {
  totalCount: number;
  recent: BreachEntry[];
  fetchedAt: string;
  source: string;
  fromCache: boolean;
}

export interface StalkerwareSample {
  app: string;
  category: string;
  platform: string;
}

export interface StalkerwareSnapshot {
  totalAppFamilies: number;
  totalIoc: number;
  samples: StalkerwareSample[];
  fetchedAt: string;
  source: string;
  fromCache: boolean;
}

type LiveState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: string };

function useLiveEndpoint<T>(path: string): LiveState<T> {
  const [state, setState] = useState<LiveState<T>>({
    status: 'loading',
    data: null,
    error: null,
  });
  const inFlight = useRef(false);

  useEffect(() => {
    if (inFlight.current) return;
    inFlight.current = true;

    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as T;
        setState({ status: 'ready', data, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Fetch failed';
        setState({ status: 'error', data: null, error: message });
      } finally {
        inFlight.current = false;
      }
    })();

    return () => {
      controller.abort();
    };
  }, [path]);

  return state;
}

export function useKevFeed() {
  return useLiveEndpoint<KevSnapshot>('/api/threat/kev');
}

export function useBreachFeed() {
  return useLiveEndpoint<BreachSnapshot>('/api/threat/breaches');
}

export function useStalkerwareFeed() {
  return useLiveEndpoint<StalkerwareSnapshot>('/api/threat/stalkerware');
}
