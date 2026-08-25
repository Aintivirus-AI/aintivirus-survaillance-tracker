import { promises as fs } from 'fs';

import {
  NominatimGeocoder,
  ReverseGeocodeParams,
  ReverseGeocodeResult,
} from '../geocoding/nominatim.geocoder';

/**
 * A JSON-file-backed cache around NominatimGeocoder.
 *
 * Nominatim allows one request per ~1.1s, and the Overpass connector reverse
 * geocodes every node that lacks address tags — which is most of them. Without
 * a cache every nightly run re-geocodes ~14k stable coordinates and takes
 * hours; with it, a steady-state run only geocodes nodes that are actually new.
 *
 * Camera coordinates are effectively immutable, so entries never expire. A
 * lookup failure is cached as `null` for the run but not persisted, so a
 * transient Nominatim error doesn't poison the cache forever.
 */
export class CachingGeocoder {
  private cache = new Map<string, ReverseGeocodeResult | null>();
  private dirty = false;
  private liveLookups = 0;

  constructor(
    private readonly inner: NominatimGeocoder,
    private readonly cachePath: string,
    /**
     * Cap on live Nominatim lookups per run. The OSM ALPR set grew from 14k
     * nodes to 84k+ in 2026; an uncapped cold run would hold Nominatim's
     * 1 req/s lane for a full day. Uncached nodes beyond the budget resolve
     * to undefined this run — they keep their coordinates, render on the map,
     * and get enriched by later runs as the cache accumulates.
     */
    private readonly liveBudget = Number(
      process.env.GEOCODE_BUDGET ?? '4000',
    ),
  ) {}

  get liveLookupsUsed(): number {
    return this.liveLookups;
  }

  private key(params: ReverseGeocodeParams): string {
    // 5 decimal places ≈ 1.1m — well under the spacing of distinct cameras.
    return `${params.latitude.toFixed(5)},${params.longitude.toFixed(5)}`;
  }

  async load(): Promise<number> {
    try {
      const raw = await fs.readFile(this.cachePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, ReverseGeocodeResult>;
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === 'object') this.cache.set(k, v);
      }
    } catch {
      // No cache yet — first run.
    }
    return this.cache.size;
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    const out: Record<string, ReverseGeocodeResult> = {};
    for (const [k, v] of this.cache.entries()) {
      if (v !== null) out[k] = v;
    }
    await fs.writeFile(this.cachePath, JSON.stringify(out));
  }

  get size(): number {
    return this.cache.size;
  }

  async reverseGeocode(
    params: ReverseGeocodeParams,
  ): Promise<ReverseGeocodeResult | undefined> {
    const k = this.key(params);
    if (this.cache.has(k)) {
      return this.cache.get(k) ?? undefined;
    }
    if (this.liveLookups >= this.liveBudget) {
      return undefined;
    }
    this.liveLookups++;
    try {
      const result = await this.inner.reverseGeocode(params);
      this.cache.set(k, result ?? null);
      if (result) this.dirty = true;
      // Checkpoint periodically: a killed run keeps the geocoding it paid for.
      if (this.dirty && this.liveLookups % 200 === 0) {
        await this.save();
        this.dirty = true;
      }
      return result;
    } catch (error) {
      // Cache the miss for this run only, so one bad coordinate doesn't get
      // retried for every record that shares it.
      this.cache.set(k, null);
      throw error;
    }
  }
}
