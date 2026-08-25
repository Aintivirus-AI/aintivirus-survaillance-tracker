/**
 * Threat-intel endpoints, ported from the NestJS threat-intel module.
 *
 * Three public feeds transformed into the exact snapshot shapes the frontend
 * hooks expect (KevSnapshot / BreachSnapshot / StalkerwareSnapshot). The old
 * service kept an in-process TTL cache; here the edge cache plays that role,
 * six hours per feed — these sources update at most daily.
 */
const KEV_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const HIBP_BREACHES_URL = 'https://haveibeenpwned.com/api/v3/breaches';
const STALKERWARE_URL =
  'https://raw.githubusercontent.com/AssoEchap/stalkerware-indicators/master/ioc.yaml';

const CACHE_TTL_SECONDS = 6 * 60 * 60;
const USER_AGENT =
  'stuffmonger-surveillance-tracker/2.0 (+https://tracker.stuffmonger.com; contact=uhnlit@gmail.com)';

export async function onRequestGet(context) {
  const { request, params } = context;

  const builders = { kev: buildKev, breaches: buildBreaches, stalkerware: buildStalkerware };
  const build = builders[params.feed];
  if (!build) return new Response('Not found', { status: 404 });

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let snapshot;
  try {
    snapshot = await build();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `${params.feed} feed unavailable` }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }

  const response = new Response(JSON.stringify(snapshot), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${CACHE_TTL_SECONDS}`,
      'access-control-allow-origin': '*',
    },
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function fetchUpstream(url, accept) {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept },
    cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res;
}

async function buildKev() {
  const data = await (await fetchUpstream(KEV_URL, 'application/json')).json();
  const vulns = (data.vulnerabilities ?? []).slice();
  vulns.sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''));
  return {
    totalCount: typeof data.count === 'number' ? data.count : vulns.length,
    latest: vulns.slice(0, 20).map((v) => ({
      cveId: v.cveID,
      vendor: v.vendorProject,
      product: v.product,
      vulnerabilityName: v.vulnerabilityName,
      dateAdded: v.dateAdded,
      shortDescription: v.shortDescription,
      knownRansomwareCampaignUse:
        (v.knownRansomwareCampaignUse ?? '').toLowerCase() === 'known',
    })),
    fetchedAt: new Date().toISOString(),
    catalogVersion: data.catalogVersion ?? null,
    source: 'CISA Known Exploited Vulnerabilities',
    fromCache: false,
  };
}

async function buildBreaches() {
  const data = await (await fetchUpstream(HIBP_BREACHES_URL, 'application/json')).json();
  const list = (data ?? []).slice();
  list.sort((a, b) => (b.BreachDate ?? '').localeCompare(a.BreachDate ?? ''));
  return {
    totalCount: list.length,
    recent: list.slice(0, 20).map((b) => ({
      name: b.Name,
      title: b.Title,
      domain: b.Domain,
      breachDate: b.BreachDate,
      pwnCount: b.PwnCount,
      isVerified: !!b.IsVerified,
      isSensitive: !!b.IsSensitive,
      dataClasses: b.DataClasses ?? [],
    })),
    fetchedAt: new Date().toISOString(),
    source: 'Have I Been Pwned',
    fromCache: false,
  };
}

async function buildStalkerware() {
  const yaml = await (await fetchUpstream(STALKERWARE_URL, 'text/plain')).text();
  const entries = parseStalkerwareYaml(yaml);
  const seen = new Set();
  const samples = [];
  for (const e of entries) {
    const key = `${e.app}|${e.platform}`;
    if (seen.has(key)) continue;
    seen.add(key);
    samples.push(e);
    if (samples.length >= 40) break;
  }
  return {
    totalAppFamilies: new Set(entries.map((e) => e.app)).size,
    totalIoc: entries.length,
    samples,
    fetchedAt: new Date().toISOString(),
    source: 'AssoEchap / stalkerware-indicators',
    fromCache: false,
  };
}

/** Line-oriented parse of the IOC yaml; ported verbatim from the old service. */
function parseStalkerwareYaml(yaml) {
  const out = [];
  const lines = yaml.split(/\r?\n/);
  let currentApp = null;
  let currentCategory = 'stalkerware';
  let platformHints = new Set();

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
    const nameMatch = /^-\s+name:\s*"?([^"\n]+?)"?\s*$/.exec(line);
    if (nameMatch) {
      flushCurrent();
      currentApp = nameMatch[1].trim();
      continue;
    }
    if (!currentApp) continue;
    const typeMatch = /^\s{2,}type:\s*"?([^"\n]+?)"?\s*$/.exec(line);
    if (typeMatch) {
      currentCategory = typeMatch[1].trim();
      continue;
    }
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
