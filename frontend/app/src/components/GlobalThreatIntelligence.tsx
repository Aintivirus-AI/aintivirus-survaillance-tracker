import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COUNTRY_RISK_DB,
  DATA_AS_OF,
  OVERVIEW_STATS,
  SOURCE_CITATIONS,
  THREAT_FEED,
  type CountryRisk,
  type SourceId,
  type ThreatFeedItem,
  type ThreatSeverity,
} from '../data/gti';
import {
  useBreachFeed,
  useKevFeed,
  useStalkerwareFeed,
  type BreachEntry,
  type KevEntry,
} from '../hooks/useThreatIntel';

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function severityClass(severity: ThreatSeverity): string {
  return `gti-severity gti-severity--${severity.toLowerCase()}`;
}

function riskColor(score: number, invert = false): string {
  const eff = invert ? 100 - score : score;
  if (eff > 70) return 'var(--gti-critical)';
  if (eff > 50) return 'var(--gti-high)';
  if (eff > 30) return 'var(--gti-medium)';
  return 'var(--gti-safe)';
}

function surveillanceColor(level: string): string {
  if (level === 'Extreme' || level === 'Very High') return 'var(--gti-critical)';
  if (level === 'High') return 'var(--gti-high)';
  if (level === 'Moderate') return 'var(--gti-medium)';
  return 'var(--gti-text)';
}

function monthLabel(iso: string): string {
  // "2026-04" → "April 2026"
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return iso;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * requestAnimationFrame counter — smooth, ease-out-cubic ramp from 0 to target.
 * Replaces setInterval for a cleaner animation that doesn't jitter under load.
 */
function useAnimatedNumber(target: number, durationMs = 1400): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}

function HudCorners() {
  return (
    <>
      <span className="hud-corner hud-corner-tl" aria-hidden="true" />
      <span className="hud-corner hud-corner-tr" aria-hidden="true" />
      <span className="hud-corner hud-corner-bl" aria-hidden="true" />
      <span className="hud-corner hud-corner-br" aria-hidden="true" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  SUB-COMPONENTS                                                     */
/* ------------------------------------------------------------------ */

function OverviewStatTile({ label, value, source, tooltip, live }: { label: string; value: number; source: SourceId | string; tooltip: string; live?: boolean }) {
  const displayed = useAnimatedNumber(value);
  return (
    <div className="gti-stat" title={tooltip}>
      <strong className="gti-stat-value">{displayed.toLocaleString()}</strong>
      <span className="gti-stat-label">{label}</span>
      <span className={`gti-stat-source ${live ? 'gti-stat-source--live' : ''}`}>
        {live && <span className="gti-stat-live-dot" aria-hidden="true" />}
        {source}
      </span>
    </div>
  );
}

function GlobalThreatOverview() {
  const kev = useKevFeed();
  const breaches = useBreachFeed();

  // Start with reference snapshot values; overwrite the KEV tile + breach tile
  // once live data arrives. Breaches is a new tile that replaces the static
  // "Countries benchmarked" when live — keeping four tiles consistent.
  const tiles = useMemo(() => {
    const base = [...OVERVIEW_STATS];
    // Update KEV tile if live
    const kevIdx = base.findIndex((s) => s.source === 'KEV');
    if (kevIdx >= 0 && kev.status === 'ready') {
      base[kevIdx] = {
        ...base[kevIdx],
        value: kev.data.totalCount,
        label: 'Known-exploited CVEs (live)',
        tooltip: `${kev.data.totalCount} CVEs in CISA KEV · version ${kev.data.catalogVersion ?? 'n/a'}`,
      };
    }
    // Replace the last tile (Countries benchmarked) with live breach count when available
    if (breaches.status === 'ready') {
      const last = base.length - 1;
      base[last] = {
        label: 'Public breaches tracked (live)',
        value: breaches.data.totalCount,
        source: 'KEV' as SourceId, // reuse KEV id just for the badge style; actual source shown below
        tooltip: `${breaches.data.totalCount} verified public breaches · HaveIBeenPwned`,
      };
    }
    return base;
  }, [kev, breaches]);

  return (
    <div className="gti-card">
      <HudCorners />
      <div className="gti-card-header">
        <h3>Global Threat Landscape</h3>
        <span className={`gti-badge ${kev.status === 'ready' || breaches.status === 'ready' ? 'gti-badge--live' : 'gti-badge--dim'}`}>
          <span className="gti-pulse" aria-hidden="true" />
          {kev.status === 'ready' || breaches.status === 'ready' ? 'Live' : `Reference · ${monthLabel(DATA_AS_OF)}`}
        </span>
      </div>
      <p className="gti-card-lead">
        Two tiles pull live from CISA KEV + HaveIBeenPwned; the others are reference indices. Every number is sourced.
      </p>
      <div className="gti-stats-grid">
        {tiles.map((s, i) => (
          <OverviewStatTile
            key={`${s.label}-${i}`}
            label={s.label}
            value={s.value}
            source={s.source === 'KEV' && breaches.status === 'ready' && i === tiles.length - 1 ? 'HIBP' : s.source}
            tooltip={s.tooltip}
            live={(s.label.includes('live')) ? true : false}
          />
        ))}
      </div>
    </div>
  );
}

function ScoreRing({ value, invert = false, label }: { value: number; invert?: boolean; label: string }) {
  const color = riskColor(value, invert);
  const circumference = 188.5; // 2π × 30
  const dashArray = `${(value / 100) * circumference} ${circumference}`;
  const animated = useAnimatedNumber(value, 900);
  return (
    <div className="gti-score-ring">
      <svg viewBox="0 0 72 72" className="gti-ring-svg" aria-hidden="true">
        <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r="30" fill="none"
          stroke={color}
          strokeWidth="5" strokeLinecap="round"
          strokeDasharray={dashArray}
          transform="rotate(-90 36 36)"
          style={{ filter: `drop-shadow(0 0 5px ${color})` }}
        />
      </svg>
      <span className="gti-ring-value" style={{ color }}>{animated}</span>
      <span className="gti-ring-label">{label}</span>
    </div>
  );
}

function CountryCard({ country, onChange }: { country: CountryRisk; onChange: (name: string) => void }) {
  const overall = Math.round((country.cyberThreat + (100 - country.privacyScore)) / 2);
  const level: ThreatSeverity =
    overall > 70 ? 'CRITICAL' : overall > 50 ? 'HIGH' : 'MEDIUM';

  return (
    <div className="gti-card">
      <HudCorners />
      <div className="gti-card-header">
        <h3>
          <span className="gti-country-flag" aria-hidden="true">{country.flag}</span>
          Country Risk &mdash; {country.name}
        </h3>
        <span className={severityClass(level)}>{level}</span>
      </div>

      <div className="gti-country-picker-wrap">
        <label className="gti-country-picker-label" htmlFor="gti-country-picker">Switch country</label>
        <select
          id="gti-country-picker"
          className="gti-country-picker"
          value={country.name}
          onChange={(e) => onChange(e.target.value)}
        >
          {Object.values(COUNTRY_RISK_DB)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <option key={c.name} value={c.name}>
                {c.flag} {c.name}
              </option>
            ))}
        </select>
      </div>

      <div className="gti-scores">
        <ScoreRing value={country.cyberThreat} label="Cyber Threat" />
        <ScoreRing value={country.privacyScore} invert label="Privacy Score" />
      </div>

      <div className="gti-rows">
        <div className="gti-row">
          <span>Surveillance Level</span>
          <span style={{ color: surveillanceColor(country.surveillanceLevel) }}>{country.surveillanceLevel}</span>
        </div>
        <div className="gti-row">
          <span>Censorship</span>
          <span>{country.censorship}</span>
        </div>
        <div className="gti-row">
          <span>Data Retention</span>
          <span>{country.dataRetention}</span>
        </div>
        <div className="gti-row">
          <span>Five Eyes Alliance</span>
          <span style={{ color: country.fiveEyes ? 'var(--gti-high)' : 'var(--gti-dim)' }}>
            {country.fiveEyes ? 'Member' : 'Not a member'}
          </span>
        </div>
        {country.fotn !== null && (
          <div className="gti-row">
            <span>Internet Freedom <sup className="gti-source-sup">FOTN</sup></span>
            <span>{country.fotn}/100</span>
          </div>
        )}
        {country.gci !== null && (
          <div className="gti-row">
            <span>Cybersecurity Maturity <sup className="gti-source-sup">GCI</sup></span>
            <span>{country.gci}/100</span>
          </div>
        )}
      </div>

      {country.knownAPTs.length > 0 && (
        <div className="gti-tags-section">
          <span className="gti-tags-label">
            Attributed APT Groups
            <sup className="gti-source-sup">MITRE ATT&amp;CK</sup>
          </span>
          <div className="gti-tags">
            {country.knownAPTs.map((apt) => (
              <span
                key={apt.name}
                className="gti-tag gti-tag--danger"
                title={apt.mitreId ? `MITRE Group ${apt.mitreId}` : undefined}
              >
                {apt.name}
                {apt.mitreId && <span className="gti-tag-mitre">· {apt.mitreId}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {country.recentIncidents.length > 0 && (
        <div className="gti-incidents">
          <span className="gti-tags-label">Recent Incidents (public)</span>
          {country.recentIncidents.map((inc) => (
            <div key={inc.title} className="gti-incident">
              <span className="gti-incident-dot" aria-hidden="true" />
              <span className="gti-incident-title">{inc.title}</span>
              <span className="gti-incident-year">{inc.year}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function kevToFeedItem(entry: KevEntry): ThreatFeedItem {
  // Severity heuristic: if the CVE is in a known ransomware campaign it's CRITICAL,
  // otherwise HIGH (CISA KEV is by definition actively-exploited — no MEDIUM bucket).
  const severity: ThreatSeverity = entry.knownRansomwareCampaignUse ? 'CRITICAL' : 'HIGH';
  return {
    severity,
    source: 'KEV',
    reference: entry.cveId,
    message: `${entry.vendor} ${entry.product} — ${entry.vulnerabilityName}${entry.knownRansomwareCampaignUse ? ' (ransomware use confirmed)' : ''}`,
    region: `Added ${entry.dateAdded}`,
  };
}

function LiveThreatFeed() {
  const kev = useKevFeed();

  // Merge live KEV top-10 (newest first) with curated feed items. Live items
  // take the lead positions so users see the freshest CVEs.
  const merged: ThreatFeedItem[] = useMemo(() => {
    if (kev.status === 'ready') {
      const live = kev.data.latest.slice(0, 10).map(kevToFeedItem);
      // De-dup against curated feed by reference
      const liveRefs = new Set(live.map((i) => i.reference));
      const curated = THREAT_FEED.filter((i) => !liveRefs.has(i.reference));
      return [...live, ...curated];
    }
    return THREAT_FEED;
  }, [kev]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (merged.length === 0) return;
    setIndex(0);
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % merged.length);
    }, 4200);
    return () => clearInterval(interval);
  }, [merged]);

  const current: ThreatFeedItem | undefined = merged[index];
  if (!current) return null;

  return (
    <div className="gti-card">
      <HudCorners />
      <div className="gti-card-header">
        <h3>Active Threat Signals</h3>
        <span className={`gti-badge ${kev.status === 'ready' ? 'gti-badge--live' : 'gti-badge--dim'}`}>
          <span className="gti-pulse" aria-hidden="true" />
          {kev.status === 'ready' ? `Live · CISA KEV ${kev.data.catalogVersion ?? ''}` : 'Curated · rotating'}
        </span>
      </div>
      <p className="gti-card-lead">
        {kev.status === 'ready'
          ? `Top ${Math.min(10, kev.data.latest.length)} entries pulled from CISA's Known Exploited Vulnerabilities feed, blended with curated MITRE campaign references. Every entry is clickable.`
          : 'Named campaigns + CVEs drawn from CISA KEV and MITRE ATT&CK. References are clickable below.'}
      </p>

      <div className="gti-feed-featured" key={index}>
        <div className="gti-feed-meta">
          <span className={severityClass(current.severity)}>{current.severity}</span>
          <span className="gti-feed-source">{current.source}</span>
          <a
            className="gti-feed-ref"
            href={referenceUrl(current)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {current.reference}
          </a>
          <span className="gti-feed-region">{current.region}</span>
        </div>
        <p className="gti-feed-message">{current.message}</p>
      </div>

      <div className="gti-feed-list">
        {merged.slice(0, 10).map((item, i) => (
          <div
            key={`${item.reference}-${i}`}
            className={`gti-feed-row ${i === index % 10 ? 'gti-feed-row--active' : ''}`}
          >
            <span className={severityClass(item.severity)}>{item.severity.charAt(0)}</span>
            <span className="gti-feed-ref-small">{item.reference}</span>
            <span className="gti-feed-row-msg">{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  New panels: Recent Breaches + Stalkerware                          */
/* ------------------------------------------------------------------ */

function formatPwnCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function RecentBreachesCard() {
  const breaches = useBreachFeed();

  if (breaches.status === 'error') {
    return null;
  }

  return (
    <div className="gti-card">
      <HudCorners />
      <div className="gti-card-header">
        <h3>Recent Public Breaches</h3>
        <span className={`gti-badge ${breaches.status === 'ready' ? 'gti-badge--live' : 'gti-badge--dim'}`}>
          <span className="gti-pulse" aria-hidden="true" />
          {breaches.status === 'ready' ? `Live · HaveIBeenPwned (${breaches.data.totalCount})` : 'Loading…'}
        </span>
      </div>
      <p className="gti-card-lead">
        The most recently disclosed public data breaches tracked by HaveIBeenPwned. Sensitive breaches (marked with a warning) include SSNs, passwords, or similar high-impact data.
      </p>

      {breaches.status === 'loading' && <div className="gti-empty">Fetching…</div>}

      {breaches.status === 'ready' && (
        <div className="gti-breaches">
          {breaches.data.recent.slice(0, 8).map((b: BreachEntry) => (
            <a
              key={b.name}
              className={`gti-breach ${b.isSensitive ? 'gti-breach--sensitive' : ''}`}
              href={`https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(b.name)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="gti-breach-head">
                <span className="gti-breach-title">{b.title}</span>
                {b.isSensitive && (
                  <span className="gti-breach-flag" title="Sensitive breach">⚠</span>
                )}
              </div>
              <div className="gti-breach-meta">
                <span className="gti-breach-domain">{b.domain || '—'}</span>
                <span className="gti-breach-count">{formatPwnCount(b.pwnCount)} accounts</span>
                <span className="gti-breach-date">{b.breachDate}</span>
              </div>
              {b.dataClasses.length > 0 && (
                <div className="gti-breach-classes">
                  {b.dataClasses.slice(0, 4).map((dc) => (
                    <span key={dc} className="gti-breach-class">{dc}</span>
                  ))}
                  {b.dataClasses.length > 4 && (
                    <span className="gti-breach-class">+{b.dataClasses.length - 4}</span>
                  )}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function StalkerwareCard() {
  const sw = useStalkerwareFeed();

  if (sw.status === 'error') {
    return null;
  }

  return (
    <div className="gti-card">
      <HudCorners />
      <div className="gti-card-header">
        <h3>Known Stalkerware Families</h3>
        <span className={`gti-badge ${sw.status === 'ready' ? 'gti-badge--live' : 'gti-badge--dim'}`}>
          <span className="gti-pulse" aria-hidden="true" />
          {sw.status === 'ready' ? `${sw.data.totalAppFamilies} families · ${sw.data.totalIoc} IOCs` : 'Loading…'}
        </span>
      </div>
      <p className="gti-card-lead">
        Commercial surveillance apps that hide on a partner or family member's device. Catalog maintained by Echap and shared with Malwarebytes, Kaspersky, Avast.
      </p>

      {sw.status === 'loading' && <div className="gti-empty">Fetching…</div>}

      {sw.status === 'ready' && (
        <div className="gti-stalkerware-grid">
          {sw.data.samples.slice(0, 18).map((s) => (
            <div key={`${s.app}-${s.platform}`} className="gti-stalkerware-tag">
              <span className="gti-stalkerware-name">{s.app}</span>
              <span className={`gti-stalkerware-platform gti-stalkerware-platform--${s.platform.toLowerCase().replace(/\W/g, '')}`}>
                {s.platform}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function referenceUrl(item: ThreatFeedItem): string {
  if (item.reference.startsWith('CVE-')) {
    return `https://nvd.nist.gov/vuln/detail/${item.reference}`;
  }
  if (item.reference.startsWith('G') && /^G\d+$/.test(item.reference)) {
    return `https://attack.mitre.org/groups/${item.reference}/`;
  }
  if (/^T\d/.test(item.reference)) {
    return `https://attack.mitre.org/techniques/${item.reference.replace('.', '/')}/`;
  }
  return 'https://attack.mitre.org/';
}

function ExposureAssessment() {
  const target = 78;
  const score = useAnimatedNumber(target, 1400);

  type Vector = { label: string; detected: boolean; isProtection?: boolean };
  const vectors: Vector[] = [
    { label: 'IP address exposed', detected: true },
    { label: 'Canvas fingerprint captured', detected: true },
    { label: 'WebGL fingerprint captured', detected: true },
    { label: 'Audio fingerprint captured', detected: true },
    { label: 'Cross-browser ID generated', detected: true },
    { label: 'Ad blocker active', detected: false, isProtection: true },
    { label: 'Do Not Track enabled', detected: false, isProtection: true },
    { label: 'VPN active', detected: false, isProtection: true },
    { label: 'WebRTC leak detected', detected: true },
  ];

  const atRisk = (v: Vector) => (v.isProtection ? !v.detected : v.detected);

  const barColor = score > 70
    ? 'linear-gradient(to right, #f87171, #ef4444)'
    : score > 40
      ? 'linear-gradient(to right, #facc15, #f59e0b)'
      : 'linear-gradient(to right, #4ade80, #22c55e)';

  return (
    <div className="gti-card">
      <HudCorners />
      <div className="gti-card-header">
        <h3>Your Exposure (Simulated)</h3>
        <span className={`gti-severity ${score > 70 ? 'gti-severity--critical' : score > 40 ? 'gti-severity--high' : 'gti-severity--medium'}`}>
          {score}/100
        </span>
      </div>
      <p className="gti-card-lead">
        A rough model of what a typical tracker network sees on an un-hardened browser — see the
        Watcher site for your real fingerprint readout.
      </p>

      <div className="gti-exposure-bar-wrap">
        <div className="gti-exposure-bar-track">
          <div className="gti-exposure-bar-fill" style={{ width: `${score}%`, background: barColor }} />
        </div>
        <div className="gti-exposure-bar-labels">
          <span>Digital Exposure</span>
          <span>{score}%</span>
        </div>
      </div>

      <div className="gti-rows">
        {vectors.map((v) => {
          const risk = atRisk(v);
          return (
            <div key={v.label} className="gti-row">
              <span>{v.label}</span>
              <span
                className={`gti-status-dot ${risk ? 'gti-status-dot--alert' : 'gti-status-dot--safe'}`}
                aria-label={risk ? 'Exposed' : 'Safe'}
              >
                {v.detected ? 'Yes' : 'No'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExtensionCTA() {
  const features = [
    'Blocks canvas, WebGL & audio fingerprinting',
    'Spoofs your browser identity on every page load',
    'Prevents cross-site tracking & cookie syncing',
    'Masks WebRTC local IP leaks',
    'Randomizes hardware & font enumeration signals',
    'Zero-knowledge — all protection runs locally',
  ];

  return (
    <div className="gti-card gti-card--cta">
      <HudCorners />
      <div className="gti-card-header">
        <h3>Protect Yourself</h3>
        <span className="gti-badge gti-badge--shield">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Extension
        </span>
      </div>

      <p className="gti-cta-desc">
        The threats above are real — and they apply to <em>you</em> right now.
        The AIntivirus browser extension neutralizes fingerprinting, spoofs your
        digital identity, and keeps every tracker on this page blind.
      </p>

      <div className="gti-cta-features">
        {features.map((f) => (
          <div key={f} className="gti-cta-feature">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gti-safe)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>{f}</span>
          </div>
        ))}
      </div>

      <a
        className="gti-cta-button"
        href="https://chromewebstore.google.com/detail/jkpokhekaohljmphbggdpemdapgjnhli?utm_source=item-share-cb"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>
        Add to Chrome — It&apos;s Free
      </a>

      <p className="gti-cta-note">
        Works on Chrome, Brave, Edge, and all Chromium browsers.
      </p>
    </div>
  );
}

function SourcesPanel() {
  return (
    <div className="gti-sources">
      <div className="gti-sources-header">
        <h4>Data Sources</h4>
        <span className="gti-sources-stamp">Snapshot · {monthLabel(DATA_AS_OF)}</span>
      </div>
      <ul className="gti-sources-list">
        {SOURCE_CITATIONS.map((s) => (
          <li key={s.id}>
            <span className="gti-source-badge">{s.id}</span>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN EXPORT                                                        */
/* ------------------------------------------------------------------ */

function GlobalThreatIntelligence() {
  const [country, setCountry] = useState<string>('United States');
  const active = useMemo(
    () => COUNTRY_RISK_DB[country] ?? COUNTRY_RISK_DB['United States'],
    [country],
  );

  return (
    <section className="gti-section" aria-labelledby="gti-heading">
      <header className="gti-intro">
        <div className="gti-intro-label">
          <span className="gti-intro-dot" aria-hidden="true" />
          Intelligence Brief
        </div>
        <h2 id="gti-heading">Global Threat Intelligence</h2>
        <p>
          Country-level surveillance profiling, active campaign tracking, and a simulated
          exposure readout — all drawn from public catalogs (CISA KEV, MITRE ATT&amp;CK,
          Freedom House, ITU). Reference snapshot, <strong>{monthLabel(DATA_AS_OF)}</strong>.
        </p>
      </header>

      <div className="gti-grid">
        <GlobalThreatOverview />
        <CountryCard country={active} onChange={setCountry} />
      </div>
      <LiveThreatFeed />
      <div className="gti-grid">
        <RecentBreachesCard />
        <StalkerwareCard />
      </div>
      <div className="gti-grid">
        <ExposureAssessment />
        <ExtensionCTA />
      </div>

      <SourcesPanel />
    </section>
  );
}

export default GlobalThreatIntelligence;
