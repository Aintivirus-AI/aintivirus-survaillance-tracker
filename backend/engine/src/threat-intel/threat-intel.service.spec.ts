import { ThreatIntelService, parseStalkerwareYaml } from './threat-intel.service';

/**
 * These tests exercise the ThreatIntelService with a mocked global.fetch so the
 * test suite doesn't hit CISA / HIBP / GitHub from CI. They cover:
 *   - KEV payload parsing (sort by dateAdded, latest slice)
 *   - ransomware flag derivation
 *   - HIBP breach sorting by date
 *   - cache behavior (second call does not re-fetch)
 *   - stale-cache fallback on upstream failure
 *   - YAML parser platform inference
 */

type FetchMock = ReturnType<typeof jest.fn>;

const realFetch = globalThis.fetch;

function mockFetchOnce(status: number, body: unknown | string, contentType = 'application/json') {
  const fetchMock = globalThis.fetch as FetchMock;
  fetchMock.mockImplementationOnce(async () => {
    return new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      {
        status,
        headers: { 'content-type': contentType },
      },
    );
  });
}

function mockFetchFailOnce(message = 'network error') {
  const fetchMock = globalThis.fetch as FetchMock;
  fetchMock.mockImplementationOnce(() => Promise.reject(new Error(message)));
}

beforeEach(() => {
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('ThreatIntelService.getKev', () => {
  it('maps upstream KEV payload into snapshot shape', async () => {
    const svc = new ThreatIntelService();
    mockFetchOnce(200, {
      catalogVersion: '2026.04.17',
      count: 1247,
      vulnerabilities: [
        { cveID: 'CVE-2024-47575', vendorProject: 'Fortinet', product: 'FortiManager', vulnerabilityName: 'FortiJump', dateAdded: '2024-10-23', shortDescription: 'Auth bypass', knownRansomwareCampaignUse: 'Known' },
        { cveID: 'CVE-2024-21412', vendorProject: 'Microsoft', product: 'SmartScreen', vulnerabilityName: 'Bypass', dateAdded: '2024-02-13', shortDescription: 'Smart screen bypass', knownRansomwareCampaignUse: 'Unknown' },
      ],
    });

    const result = await svc.getKev();

    expect(result.totalCount).toBe(1247);
    expect(result.catalogVersion).toBe('2026.04.17');
    expect(result.latest).toHaveLength(2);
    // Latest first by dateAdded desc
    expect(result.latest[0].cveId).toBe('CVE-2024-47575');
    expect(result.latest[0].knownRansomwareCampaignUse).toBe(true);
    expect(result.latest[1].knownRansomwareCampaignUse).toBe(false);
    expect(result.fromCache).toBe(false);
  });

  it('serves cached snapshot on subsequent calls within TTL', async () => {
    const svc = new ThreatIntelService();
    mockFetchOnce(200, { count: 3, vulnerabilities: [] });
    await svc.getKev();
    const second = await svc.getKev();
    expect(second.fromCache).toBe(true);
    expect((globalThis.fetch as FetchMock).mock.calls.length).toBe(1);
  });

  it('falls back to stale cache on upstream failure', async () => {
    const svc = new ThreatIntelService();
    mockFetchOnce(200, { count: 5, vulnerabilities: [] });
    const first = await svc.getKev();
    expect(first.totalCount).toBe(5);

    // Force TTL expiry
    (svc as unknown as { kevCache: { expiresAt: number } }).kevCache.expiresAt = 0;

    mockFetchFailOnce();
    const second = await svc.getKev();
    expect(second.totalCount).toBe(5);
    expect(second.fromCache).toBe(true);
  });

  it('throws when no cache and upstream fails', async () => {
    const svc = new ThreatIntelService();
    mockFetchFailOnce();
    await expect(svc.getKev()).rejects.toThrow();
  });
});

describe('ThreatIntelService.getBreaches', () => {
  it('sorts breaches newest-first and maps to the compact shape', async () => {
    const svc = new ThreatIntelService();
    mockFetchOnce(200, [
      { Name: 'AShop', Title: 'A Shop', Domain: 'a.example', BreachDate: '2022-01-05', PwnCount: 10, IsVerified: true, IsSensitive: false, DataClasses: ['Emails'] },
      { Name: 'BCorp', Title: 'B Corp', Domain: 'b.example', BreachDate: '2024-08-12', PwnCount: 2_000_000, IsVerified: true, IsSensitive: true, DataClasses: ['Emails', 'Passwords'] },
      { Name: 'CNet', Title: 'C Net', Domain: 'c.example', BreachDate: '2023-05-01', PwnCount: 50_000, IsVerified: false, IsSensitive: false, DataClasses: [] },
    ]);

    const result = await svc.getBreaches();

    expect(result.totalCount).toBe(3);
    expect(result.recent.map((b) => b.name)).toEqual(['BCorp', 'CNet', 'AShop']);
    expect(result.recent[0].pwnCount).toBe(2_000_000);
    expect(result.recent[0].isSensitive).toBe(true);
    expect(result.recent[0].dataClasses).toContain('Passwords');
  });
});

describe('parseStalkerwareYaml', () => {
  it('extracts name + type + inferred platform from ioc.yaml schema', () => {
    const yaml = `- name: TheTruthSpy
  names:
  - Copy9
  - ExactSpy
  type: stalkerware
  packages:
  - com.apspy.app
  - com.ispyoo
- name: mSpy
  type: stalkerware
  packages:
  - com.mspy.android
  - "123456789"
- name: SpyAgent
  type: stalkerware
  packages:
  - malware.exe
`;
    const out = parseStalkerwareYaml(yaml);
    const byApp = Object.fromEntries(out.map((e) => [e.app, e]));

    expect(byApp['TheTruthSpy'].platform).toBe('Android');
    expect(byApp['mSpy'].platform).toBe('multi-platform');
    expect(byApp['SpyAgent'].platform).toBe('Windows');
    expect(byApp['TheTruthSpy'].category).toBe('stalkerware');
  });

  it('handles empty yaml', () => {
    expect(parseStalkerwareYaml('')).toEqual([]);
  });
});
