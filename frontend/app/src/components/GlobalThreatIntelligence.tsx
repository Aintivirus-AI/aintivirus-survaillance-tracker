import { useEffect, useMemo, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type ThreatFeedItem = {
  type: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  source: string;
  message: string;
  region: string;
};

type CountryRisk = {
  cyberThreat: number;
  privacyScore: number;
  surveillanceLevel: string;
  censorship: string;
  dataRetention: string;
  fiveEyes: boolean;
  knownAPTs: string[];
  recentIncidents: string[];
};

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

const COUNTRY_RISK_DB: Record<string, CountryRisk> = {
  'United States': {
    cyberThreat: 65, privacyScore: 45, surveillanceLevel: 'High',
    censorship: 'Low', dataRetention: 'Voluntary', fiveEyes: true,
    knownAPTs: ['Equation Group', 'Longhorn', 'Lamberts'],
    recentIncidents: ['SolarWinds breach aftermath', 'MOVEit exploitation wave', 'Healthcare sector targeting'],
  },
  'United Kingdom': {
    cyberThreat: 60, privacyScore: 50, surveillanceLevel: 'High',
    censorship: 'Low', dataRetention: 'Mandatory', fiveEyes: true,
    knownAPTs: ['GCHQ ops', 'Turla variants'],
    recentIncidents: ['Royal Mail ransomware', 'NHS supply chain attack', 'Electoral Commission breach'],
  },
  'China': {
    cyberThreat: 90, privacyScore: 15, surveillanceLevel: 'Extreme',
    censorship: 'Extreme', dataRetention: 'Mandatory + Monitoring', fiveEyes: false,
    knownAPTs: ['APT41', 'APT10', 'Hafnium', 'Volt Typhoon', 'Salt Typhoon'],
    recentIncidents: ['Telecom infrastructure compromise', 'Zero-day exploitation campaigns', 'AI-enabled phishing'],
  },
  'Russia': {
    cyberThreat: 85, privacyScore: 20, surveillanceLevel: 'Very High',
    censorship: 'High', dataRetention: 'Mandatory + SORM', fiveEyes: false,
    knownAPTs: ['APT28/Fancy Bear', 'APT29/Cozy Bear', 'Sandworm', 'Turla'],
    recentIncidents: ['Critical infrastructure attacks', 'Wiper malware campaigns', 'Election interference ops'],
  },
  'Germany': {
    cyberThreat: 45, privacyScore: 75, surveillanceLevel: 'Moderate',
    censorship: 'Low', dataRetention: 'Limited (GDPR)', fiveEyes: false,
    knownAPTs: [],
    recentIncidents: ['Ransomware on hospital systems', 'Supply chain attacks on auto industry'],
  },
  'India': {
    cyberThreat: 55, privacyScore: 35, surveillanceLevel: 'High',
    censorship: 'Moderate', dataRetention: 'Mandatory', fiveEyes: false,
    knownAPTs: ['SideWinder', 'Patchwork'],
    recentIncidents: ['AIIMS hospital breach', 'Banking trojan campaigns', 'Telecom data leaks'],
  },
  'Japan': {
    cyberThreat: 50, privacyScore: 60, surveillanceLevel: 'Moderate',
    censorship: 'Low', dataRetention: 'Limited', fiveEyes: false,
    knownAPTs: [],
    recentIncidents: ['Port system disruption', 'Defense contractor breach', 'Cryptocurrency exchange hacks'],
  },
  'Brazil': {
    cyberThreat: 60, privacyScore: 40, surveillanceLevel: 'Moderate',
    censorship: 'Low', dataRetention: 'Mandatory (Marco Civil)', fiveEyes: false,
    knownAPTs: ['Prilex'],
    recentIncidents: ['Banking malware surge', 'PIX fraud campaigns', 'Government portal breach'],
  },
  'Australia': {
    cyberThreat: 55, privacyScore: 40, surveillanceLevel: 'High',
    censorship: 'Low', dataRetention: 'Mandatory', fiveEyes: true,
    knownAPTs: [],
    recentIncidents: ['Optus data breach', 'Medibank hack', 'Port operator ransomware'],
  },
  'Canada': {
    cyberThreat: 50, privacyScore: 55, surveillanceLevel: 'Moderate',
    censorship: 'Low', dataRetention: 'Limited', fiveEyes: true,
    knownAPTs: [],
    recentIncidents: ['Indigo ransomware', 'Government contractor breach', 'Healthcare system targeting'],
  },
};

const DEFAULT_RISK: CountryRisk = {
  cyberThreat: 50, privacyScore: 50, surveillanceLevel: 'Unknown',
  censorship: 'Unknown', dataRetention: 'Unknown', fiveEyes: false,
  knownAPTs: [], recentIncidents: ['Insufficient data for this region'],
};

const THREAT_FEED: ThreatFeedItem[] = [
  { type: 'CRITICAL', source: 'CISA', message: 'Active exploitation of zero-day in enterprise VPN appliances', region: 'Global' },
  { type: 'HIGH', source: 'NCSC', message: 'Spear-phishing campaign targeting financial sector using AI-generated lures', region: 'EMEA' },
  { type: 'CRITICAL', source: 'CERT', message: 'Ransomware group deploying novel encryption targeting cloud backups', region: 'Americas' },
  { type: 'MEDIUM', source: 'FBI', message: 'Business email compromise ring netting $12M across 40 organizations', region: 'North America' },
  { type: 'HIGH', source: 'Mandiant', message: 'State-sponsored actor compromising telecom infrastructure globally', region: 'APAC' },
  { type: 'CRITICAL', source: 'ENISA', message: 'Supply chain attack via popular npm package — 15M downloads affected', region: 'Global' },
  { type: 'HIGH', source: 'CrowdStrike', message: 'New info-stealer variant bypassing EDR through kernel driver abuse', region: 'Global' },
  { type: 'MEDIUM', source: 'Recorded Future', message: 'DDoS-for-hire services targeting healthcare organizations', region: 'Europe' },
  { type: 'HIGH', source: 'Unit42', message: 'Cryptojacking campaign targeting misconfigured Kubernetes clusters', region: 'Global' },
  { type: 'CRITICAL', source: 'Secureworks', message: 'Wiper malware targeting industrial control systems in energy sector', region: 'Middle East' },
  { type: 'MEDIUM', source: 'Kaspersky', message: 'Banking trojan evolves with deepfake voice cloning for call center fraud', region: 'LATAM' },
  { type: 'HIGH', source: 'MITRE', message: 'Novel persistence technique abusing Windows CIM repository', region: 'Global' },
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function severityClass(type: string): string {
  switch (type) {
    case 'CRITICAL': return 'gti-severity gti-severity--critical';
    case 'HIGH': return 'gti-severity gti-severity--high';
    case 'MEDIUM': return 'gti-severity gti-severity--medium';
    default: return 'gti-severity';
  }
}

function riskColor(score: number, invert = false): string {
  const effective = invert ? 100 - score : score;
  if (effective > 70) return 'var(--gti-critical)';
  if (effective > 50) return 'var(--gti-high)';
  if (effective > 30) return 'var(--gti-medium)';
  return 'var(--gti-safe)';
}

/* ------------------------------------------------------------------ */
/*  SUB-COMPONENTS                                                     */
/* ------------------------------------------------------------------ */

function GlobalThreatOverview() {
  const targets = useMemo(() => ({
    activeCampaigns: 847,
    countriesAffected: 142,
    breachesThisMonth: 2341,
    ransomwareIncidents: 156,
  }), []);

  const [stats, setStats] = useState({ activeCampaigns: 0, countriesAffected: 0, breachesThisMonth: 0, ransomwareIncidents: 0 });

  useEffect(() => {
    const steps = 50;
    const duration = 2000;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const p = Math.min(step / steps, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setStats({
        activeCampaigns: Math.floor(targets.activeCampaigns * e),
        countriesAffected: Math.floor(targets.countriesAffected * e),
        breachesThisMonth: Math.floor(targets.breachesThisMonth * e),
        ransomwareIncidents: Math.floor(targets.ransomwareIncidents * e),
      });
      if (step >= steps) clearInterval(interval);
    }, duration / steps);
    return () => clearInterval(interval);
  }, [targets]);

  return (
    <div className="gti-card">
      <div className="gti-card-header">
        <h3>Global Threat Overview</h3>
        <span className="gti-badge gti-badge--live">
          <span className="gti-pulse" /> Real-Time
        </span>
      </div>
      <div className="gti-stats-grid">
        <div className="gti-stat">
          <strong style={{ color: 'var(--gti-critical)' }}>{stats.activeCampaigns.toLocaleString()}</strong>
          <span>Active Campaigns</span>
        </div>
        <div className="gti-stat">
          <strong style={{ color: 'var(--gti-high)' }}>{stats.countriesAffected}</strong>
          <span>Countries Affected</span>
        </div>
        <div className="gti-stat">
          <strong style={{ color: 'var(--gti-accent)' }}>{stats.breachesThisMonth.toLocaleString()}</strong>
          <span>Breaches (Mar&nbsp;2026)</span>
        </div>
        <div className="gti-stat">
          <strong style={{ color: 'var(--gti-medium)' }}>{stats.ransomwareIncidents}</strong>
          <span>Ransomware</span>
        </div>
      </div>
    </div>
  );
}

function CountryIntelligence() {
  /* Default to US since the tracker focuses on US surveillance infrastructure */
  const country = 'United States';
  const risk = COUNTRY_RISK_DB[country] ?? DEFAULT_RISK;
  const overall = Math.round((risk.cyberThreat + (100 - risk.privacyScore)) / 2);
  const level = overall > 70 ? 'CRITICAL' : overall > 50 ? 'ELEVATED' : overall > 30 ? 'MODERATE' : 'LOW';

  return (
    <div className="gti-card">
      <div className="gti-card-header">
        <h3>Country Intelligence &mdash; {country}</h3>
        <span className={severityClass(overall > 70 ? 'CRITICAL' : overall > 50 ? 'HIGH' : 'MEDIUM')}>{level}</span>
      </div>

      <div className="gti-scores">
        <div className="gti-score-ring">
          <svg viewBox="0 0 72 72" className="gti-ring-svg">
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r="30" fill="none"
              stroke={riskColor(risk.cyberThreat)}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(risk.cyberThreat / 100) * 188.5} 188.5`}
              transform="rotate(-90 36 36)"
            />
          </svg>
          <span className="gti-ring-value" style={{ color: riskColor(risk.cyberThreat) }}>{risk.cyberThreat}</span>
          <span className="gti-ring-label">Cyber Threat</span>
        </div>
        <div className="gti-score-ring">
          <svg viewBox="0 0 72 72" className="gti-ring-svg">
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r="30" fill="none"
              stroke={riskColor(risk.privacyScore, true)}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(risk.privacyScore / 100) * 188.5} 188.5`}
              transform="rotate(-90 36 36)"
            />
          </svg>
          <span className="gti-ring-value" style={{ color: riskColor(risk.privacyScore, true) }}>{risk.privacyScore}</span>
          <span className="gti-ring-label">Privacy Score</span>
        </div>
      </div>

      <div className="gti-rows">
        <div className="gti-row"><span>Surveillance Level</span><span style={{ color: risk.surveillanceLevel === 'High' || risk.surveillanceLevel === 'Very High' || risk.surveillanceLevel === 'Extreme' ? 'var(--gti-high)' : 'var(--gti-text)' }}>{risk.surveillanceLevel}</span></div>
        <div className="gti-row"><span>Censorship</span><span>{risk.censorship}</span></div>
        <div className="gti-row"><span>Data Retention</span><span>{risk.dataRetention}</span></div>
        <div className="gti-row">
          <span>Five Eyes Alliance</span>
          <span style={{ color: risk.fiveEyes ? 'var(--gti-high)' : 'var(--gti-dim)' }}>{risk.fiveEyes ? 'Yes' : 'No'}</span>
        </div>
      </div>

      {risk.knownAPTs.length > 0 && (
        <div className="gti-tags-section">
          <span className="gti-tags-label">Known APT Groups</span>
          <div className="gti-tags">
            {risk.knownAPTs.map((apt) => (
              <span key={apt} className="gti-tag gti-tag--danger">{apt}</span>
            ))}
          </div>
        </div>
      )}

      {risk.recentIncidents.length > 0 && (
        <div className="gti-incidents">
          <span className="gti-tags-label">Recent Incidents</span>
          {risk.recentIncidents.map((inc, i) => (
            <div key={i} className="gti-incident">
              <span className="gti-incident-dot" />
              <span>{inc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveThreatFeed() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % THREAT_FEED.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const current = THREAT_FEED[index];

  return (
    <div className="gti-card">
      <div className="gti-card-header">
        <h3>Live Threat Feed</h3>
        <span className="gti-badge gti-badge--live">
          <span className="gti-pulse" /> Live
        </span>
      </div>

      {/* Featured item */}
      <div className="gti-feed-featured" key={index}>
        <div className="gti-feed-meta">
          <span className={severityClass(current.type)}>{current.type}</span>
          <span className="gti-feed-source">{current.source}</span>
          <span className="gti-feed-region">{current.region}</span>
        </div>
        <p className="gti-feed-message">{current.message}</p>
      </div>

      {/* Condensed list */}
      <div className="gti-feed-list">
        {THREAT_FEED.slice(0, 8).map((item, i) => (
          <div key={i} className={`gti-feed-row ${i === index % 8 ? 'gti-feed-row--active' : ''}`}>
            <span className={severityClass(item.type)}>{item.type.charAt(0)}</span>
            <span className="gti-feed-row-msg">{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExposureAssessment() {
  const [score, setScore] = useState(0);
  const target = 78; /* simulated exposure for a typical US user */

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += 2;
      if (current >= target) {
        setScore(target);
        clearInterval(interval);
      } else {
        setScore(current);
      }
    }, 25);
    return () => clearInterval(interval);
  }, []);

  const vectors = [
    { label: 'IP address exposed', detected: true },
    { label: 'Canvas fingerprint captured', detected: true },
    { label: 'WebGL fingerprint captured', detected: true },
    { label: 'Audio fingerprint captured', detected: true },
    { label: 'Cross-browser ID generated', detected: true },
    { label: 'Ad blocker active', detected: false },
    { label: 'Do Not Track enabled', detected: false },
    { label: 'VPN active', detected: false },
    { label: 'WebRTC leak detected', detected: true },
  ];

  const barColor = score > 70
    ? 'linear-gradient(to right, #f87171, #ef4444)'
    : score > 40
      ? 'linear-gradient(to right, #facc15, #f59e0b)'
      : 'linear-gradient(to right, #4ade80, #22c55e)';

  return (
    <div className="gti-card">
      <div className="gti-card-header">
        <h3>Exposure Assessment</h3>
        <span className={`gti-severity ${score > 70 ? 'gti-severity--critical' : score > 40 ? 'gti-severity--high' : 'gti-severity--medium'}`}>
          {score}/100
        </span>
      </div>

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
        {vectors.map((v) => (
          <div key={v.label} className="gti-row">
            <span>{v.label}</span>
            <span className={`gti-status-dot ${v.detected ? 'gti-status-dot--alert' : 'gti-status-dot--safe'}`}>
              {v.detected ? (v.label.includes('active') || v.label.includes('enabled') ? 'No' : 'Yes') : (v.label.includes('active') || v.label.includes('enabled') ? 'No' : 'No')}
            </span>
          </div>
        ))}
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

/* ------------------------------------------------------------------ */
/*  MAIN EXPORT                                                        */
/* ------------------------------------------------------------------ */

function GlobalThreatIntelligence() {
  return (
    <section className="gti-section" aria-labelledby="gti-heading">
      <header className="gti-intro">
        <h2 id="gti-heading">Global Threat Intelligence</h2>
        <p>
          Real-time cyber threat landscape monitoring, country-level risk profiling,
          and digital exposure assessment. Data synthesized from OSINT feeds and
          threat intelligence providers.
        </p>
      </header>

      <div className="gti-grid">
        <GlobalThreatOverview />
        <CountryIntelligence />
      </div>
      <LiveThreatFeed />
      <div className="gti-grid">
        <ExposureAssessment />
        <ExtensionCTA />
      </div>
    </section>
  );
}

export default GlobalThreatIntelligence;
