import { Injectable, Logger } from '@nestjs/common';

/**
 * Live threat-intel feeds (CISA KEV, HIBP breaches, stalkerware IOC).
 *
 * Each feed is fetched with an explicit polite User-Agent (per upstream ToS),
 * a 10-second timeout (so a stalled upstream never hangs a request), and
 * cached in-memory with a TTL so the frontend can poll freely without
 * hammering the provider.
 *
 * On fetch failure we return the last-good cached payload if we have one,
 * and only surface a null when there is nothing at all to serve.
 */

export interface KevEntry {
  cveId: string;
  vendor: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;                       // ISO yyyy-mm-dd
  shortDescription: string;
  knownRansomwareCampaignUse: boolean;
}

export interface KevSnapshot {
  totalCount: number;
  latest: KevEntry[];                      // most recent N (up to 20)
  fetchedAt: string;
  catalogVersion: string | null;
  source: string;
  fromCache: boolean;
}

export interface BreachEntry {
  name: string;
  title: string;
  domain: string;
  breachDate: string;                      // ISO yyyy-mm-dd
  pwnCount: number;
  isVerified: boolean;
  isSensitive: boolean;
  dataClasses: string[];
}

export interface BreachSnapshot {
  totalCount: number;
  recent: BreachEntry[];                   // most recent 20 by breachDate
  fetchedAt: string;
  source: string;
  fromCache: boolean;
}

export interface StalkerwareSnapshot {
  totalAppFamilies: number;
  totalIoc: number;
  samples: { app: string; category: string; platform: string }[];
  fetchedAt: string;
  source: string;
  fromCache: boolean;
}

const USER_AGENT = 'aintivirus-surveillance-tracker/1.0 (+https://tracker.aintivirus.ai; contact=uhnlit@gmail.com)';
const FETCH_TIMEOUT_MS = 10_000;

const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const HIBP_BREACHES_URL = 'https://haveibeenpwned.com/api/v3/breaches';
const STALKERWARE_URL =
  'https://raw.githubusercontent.com/AssoEchap/stalkerware-indicators/master/ioc.yaml';

const KEV_TTL_MS = 60 * 60 * 1000;         // 1 hour
const BREACHES_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STALKERWARE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

async function fetchJson<T>(url: string, logger: Logger): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Upstream ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to fetch ${url}: ${message}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, logger: Logger): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/plain, */*',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Upstream ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to fetch ${url}: ${message}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class ThreatIntelService {
  private readonly logger = new Logger(ThreatIntelService.name);
  private kevCache: CacheEntry<KevSnapshot> | null = null;
  private breachesCache: CacheEntry<BreachSnapshot> | null = null;
  private stalkerwareCache: CacheEntry<StalkerwareSnapshot> | null = null;

  async getKev(): Promise<KevSnapshot> {
    const now = Date.now();
    if (this.kevCache && this.kevCache.expiresAt > now) {
      return { ...this.kevCache.value, fromCache: true };
    }

    try {
      type KevPayload = {
        title?: string;
        catalogVersion?: string;
        dateReleased?: string;
        count?: number;
        vulnerabilities?: Array<{
          cveID: string;
          vendorProject: string;
          product: string;
          vulnerabilityName: string;
          dateAdded: string;
          shortDescription: string;
          knownRansomwareCampaignUse?: string;
        }>;
      };

      const data = await fetchJson<KevPayload>(KEV_URL, this.logger);
      const vulns = (data.vulnerabilities ?? []).slice();
      // Sort by dateAdded descending so "latest" is genuinely latest.
      vulns.sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''));

      const latest: KevEntry[] = vulns.slice(0, 20).map((v) => ({
        cveId: v.cveID,
        vendor: v.vendorProject,
        product: v.product,
        vulnerabilityName: v.vulnerabilityName,
        dateAdded: v.dateAdded,
        shortDescription: v.shortDescription,
        knownRansomwareCampaignUse: (v.knownRansomwareCampaignUse ?? '').toLowerCase() === 'known',
      }));

      const snapshot: KevSnapshot = {
        totalCount: typeof data.count === 'number' ? data.count : vulns.length,
        latest,
        fetchedAt: new Date().toISOString(),
        catalogVersion: data.catalogVersion ?? null,
        source: 'CISA Known Exploited Vulnerabilities',
        fromCache: false,
      };

      this.kevCache = { value: snapshot, expiresAt: now + KEV_TTL_MS };
      return snapshot;
    } catch (error) {
      if (this.kevCache) {
        this.logger.warn('Serving stale KEV cache due to upstream failure');
        return { ...this.kevCache.value, fromCache: true };
      }
      throw error;
    }
  }

  async getBreaches(): Promise<BreachSnapshot> {
    const now = Date.now();
    if (this.breachesCache && this.breachesCache.expiresAt > now) {
      return { ...this.breachesCache.value, fromCache: true };
    }

    try {
      type HibpBreach = {
        Name: string;
        Title: string;
        Domain: string;
        BreachDate: string;
        PwnCount: number;
        IsVerified: boolean;
        IsSensitive: boolean;
        DataClasses?: string[];
      };

      const data = await fetchJson<HibpBreach[]>(HIBP_BREACHES_URL, this.logger);
      const list = (data ?? []).slice();
      list.sort((a, b) => (b.BreachDate ?? '').localeCompare(a.BreachDate ?? ''));

      const recent: BreachEntry[] = list.slice(0, 20).map((b) => ({
        name: b.Name,
        title: b.Title,
        domain: b.Domain,
        breachDate: b.BreachDate,
        pwnCount: b.PwnCount,
        isVerified: !!b.IsVerified,
        isSensitive: !!b.IsSensitive,
        dataClasses: b.DataClasses ?? [],
      }));

      const snapshot: BreachSnapshot = {
        totalCount: list.length,
        recent,
        fetchedAt: new Date().toISOString(),
        source: 'Have I Been Pwned',
        fromCache: false,
      };

      this.breachesCache = { value: snapshot, expiresAt: now + BREACHES_TTL_MS };
      return snapshot;
    } catch (error) {
      if (this.breachesCache) {
        this.logger.warn('Serving stale breaches cache due to upstream failure');
        return { ...this.breachesCache.value, fromCache: true };
      }
      throw error;
    }
  }

  async getStalkerware(): Promise<StalkerwareSnapshot> {
    const now = Date.now();
    if (this.stalkerwareCache && this.stalkerwareCache.expiresAt > now) {
      return { ...this.stalkerwareCache.value, fromCache: true };
    }

    try {
      // YAML parsing without a dep — just extract simple `- app: ...` blocks.
      // The upstream file is a flat list of entries with fields we care about:
      // app / category / platform (iOS, Android, Win).
      const yaml = await fetchText(STALKERWARE_URL, this.logger);
      const entries = parseStalkerwareYaml(yaml);

      // De-dup by (app, platform) — the upstream file lists each family once but
      // multiple IOCs may be per-entry; our samples slice wants distinct families.
      const seen = new Set<string>();
      const samples: StalkerwareSnapshot['samples'] = [];
      for (const e of entries) {
        const key = `${e.app}|${e.platform}`;
        if (seen.has(key)) continue;
        seen.add(key);
        samples.push(e);
        if (samples.length >= 40) break;
      }

      const snapshot: StalkerwareSnapshot = {
        totalAppFamilies: new Set(entries.map((e) => e.app)).size,
        totalIoc: entries.length,
        samples,
        fetchedAt: new Date().toISOString(),
        source: 'AssoEchap / stalkerware-indicators',
        fromCache: false,
      };

      this.stalkerwareCache = { value: snapshot, expiresAt: now + STALKERWARE_TTL_MS };
      return snapshot;
    } catch (error) {
      if (this.stalkerwareCache) {
        this.logger.warn('Serving stale stalkerware cache due to upstream failure');
        return { ...this.stalkerwareCache.value, fromCache: true };
      }
      throw error;
    }
  }
}

/**
 * Very small YAML parser for the AssoEchap/stalkerware-indicators ioc.yaml schema.
 *
 * Real-world shape:
 *   - name: TheTruthSpy
 *     names:
 *       - Copy9
 *       - ...
 *     type: stalkerware
 *     packages:
 *       - com.apspy.app
 *     certificates:
 *       - SHA1HEX
 *
 * We pull (app, category, platform) tuples. Platform is inferred from the shape
 * of package/certificate identifiers:
 *   - reverse-domain package → Android
 *   - long numeric bundle id → iOS
 *   - *.exe or uppercase-hex-only-certs → Windows
 *   - else → "unknown"; multiple platforms detected → "multi-platform"
 */
export function parseStalkerwareYaml(yaml: string): { app: string; category: string; platform: string }[] {
  const out: { app: string; category: string; platform: string }[] = [];
  const lines = yaml.split(/\r?\n/);

  let currentApp: string | null = null;
  let currentCategory = 'stalkerware';
  let platformHints: Set<string> = new Set();

  const flushCurrent = () => {
    if (currentApp) {
      const platform =
        platformHints.size === 0 ? 'unknown'
        : platformHints.size > 1 ? 'multi-platform'
        : Array.from(platformHints)[0];
      out.push({ app: currentApp, category: currentCategory, platform });
    }
    currentApp = null;
    currentCategory = 'stalkerware';
    platformHints = new Set();
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ');

    // Top-level entry "- name: AppName" starts a new record.
    const nameMatch = /^-\s+name:\s*"?([^"\n]+?)"?\s*$/.exec(line);
    if (nameMatch) {
      flushCurrent();
      currentApp = nameMatch[1].trim();
      continue;
    }
    if (!currentApp) continue;

    // Category is declared as "  type: stalkerware" at the same indent level.
    const typeMatch = /^\s{2,}type:\s*"?([^"\n]+?)"?\s*$/.exec(line);
    if (typeMatch) {
      currentCategory = typeMatch[1].trim();
      continue;
    }

    // Package identifiers — indented list items under "packages:".
    const pkgMatch = /^\s+-\s+"?([a-zA-Z0-9._:\\/-]+)"?\s*$/.exec(line);
    if (pkgMatch) {
      const pkg = pkgMatch[1];
      if (/^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_-]+){2,}$/.test(pkg)) {
        platformHints.add('Android');
      } else if (/^\d{9,}$/.test(pkg)) {
        platformHints.add('iOS');
      } else if (/\.exe$/i.test(pkg) || /^[A-Z]:\\/i.test(pkg)) {
        platformHints.add('Windows');
      }
    }
  }
  flushCurrent();

  return out;
}
