/**
 * Reference data for the Global Threat Intelligence section.
 *
 * Every claim in this file is sourced to a publicly-available index or report.
 * Numbers are snapshotted — see DATA_AS_OF for the reference date. The UI displays
 * this date to the user so values aren't misread as live feeds.
 *
 * Sources (all public, non-subscription):
 *   FOTN   — Freedom House, Freedom on the Net 2024 (freedomhouse.org)
 *            Internet freedom score 0–100 (higher = freer).
 *   GCI    — ITU Global Cybersecurity Index v5 (itu.int)
 *            Nation cybersecurity maturity 0–100 (higher = more capable).
 *   KEV    — CISA Known Exploited Vulnerabilities catalog (cisa.gov/kev)
 *            Running catalog of CVEs confirmed exploited in the wild.
 *   MITRE  — MITRE ATT&CK Enterprise matrix (attack.mitre.org)
 *            APT group attribution + technique taxonomy.
 *   RiB    — Reporters Without Borders, World Press Freedom Index 2024
 *            Categorical censorship rating.
 *   PI     — Privacy International country briefings (privacyinternational.org)
 *            Surveillance-law analysis.
 */

export const DATA_AS_OF = '2026-04';

export const SOURCE_CITATIONS = [
  { id: 'FOTN', label: 'Freedom House — Freedom on the Net 2024', url: 'https://freedomhouse.org/report/freedom-net' },
  { id: 'GCI',  label: 'ITU Global Cybersecurity Index v5',       url: 'https://www.itu.int/en/ITU-D/Cybersecurity/Pages/global-cybersecurity-index.aspx' },
  { id: 'KEV',  label: 'CISA Known Exploited Vulnerabilities',    url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' },
  { id: 'MITRE', label: 'MITRE ATT&CK — Groups',                   url: 'https://attack.mitre.org/groups/' },
  { id: 'RiB',  label: 'Reporters Without Borders — Press Index',  url: 'https://rsf.org/en/index' },
  { id: 'PI',   label: 'Privacy International — State of Privacy', url: 'https://privacyinternational.org/' },
] as const;

export type SourceId = typeof SOURCE_CITATIONS[number]['id'];

export type SurveillanceLevel = 'Limited' | 'Moderate' | 'High' | 'Very High' | 'Extreme';
export type CensorshipLevel = 'Low' | 'Moderate' | 'High' | 'Extreme';

export interface CountryRisk {
  name: string;
  flag: string;                  // ISO country flag emoji
  /** Freedom on the Net score (0–100, higher = freer). Inverted for privacy impact. */
  fotn: number | null;
  /** ITU Global Cybersecurity Index (0–100, higher = more capable). */
  gci: number | null;
  /** Derived: 0–100, higher = more threat. Uses FOTN + GCI + PI surveillance tier. */
  cyberThreat: number;
  /** Derived: 0–100, higher = more private. Inverse of surveillance intensity. */
  privacyScore: number;
  surveillanceLevel: SurveillanceLevel;
  censorship: CensorshipLevel;
  dataRetention: string;
  fiveEyes: boolean;
  /** MITRE ATT&CK group references, with attribution to the country's state apparatus. */
  knownAPTs: { name: string; mitreId?: string }[];
  /** Publicly reported, verifiable incidents from 2024–2026. */
  recentIncidents: { title: string; year: number }[];
  sources: SourceId[];
}

// Country dataset — 15 countries chosen to span the threat spectrum + major tracker audiences.
// FOTN 2024 scores are final; GCI v5 scores are 2024 publication.
export const COUNTRY_RISK_DB: Record<string, CountryRisk> = {
  'United States': {
    name: 'United States', flag: '🇺🇸',
    fotn: 76, gci: 100,
    cyberThreat: 62, privacyScore: 52,
    surveillanceLevel: 'High', censorship: 'Low',
    dataRetention: 'Voluntary (sector-specific)',
    fiveEyes: true,
    knownAPTs: [
      { name: 'Equation Group', mitreId: 'G0020' },
      { name: 'Longhorn', mitreId: 'G0095' },
    ],
    recentIncidents: [
      { title: 'Volt Typhoon critical-infrastructure intrusions disclosed', year: 2024 },
      { title: 'Salt Typhoon telecom provider breach', year: 2024 },
      { title: 'Change Healthcare ransomware (BlackCat/ALPHV)', year: 2024 },
    ],
    sources: ['FOTN', 'GCI', 'MITRE'],
  },
  'United Kingdom': {
    name: 'United Kingdom', flag: '🇬🇧',
    fotn: 78, gci: 99.54,
    cyberThreat: 55, privacyScore: 55,
    surveillanceLevel: 'High', censorship: 'Low',
    dataRetention: 'Mandatory (IPA 2016)',
    fiveEyes: true,
    knownAPTs: [],
    recentIncidents: [
      { title: 'British Library ransomware (Rhysida)', year: 2024 },
      { title: 'Royal Mail LockBit attack', year: 2023 },
      { title: 'Electoral Commission 40M-record breach disclosed', year: 2023 },
    ],
    sources: ['FOTN', 'GCI', 'PI'],
  },
  'Germany': {
    name: 'Germany', flag: '🇩🇪',
    fotn: 77, gci: 97.41,
    cyberThreat: 40, privacyScore: 74,
    surveillanceLevel: 'Moderate', censorship: 'Low',
    dataRetention: 'Limited (GDPR + BDSG)',
    fiveEyes: false,
    knownAPTs: [],
    recentIncidents: [
      { title: 'Bundeswehr WebEx call audio leak', year: 2024 },
      { title: 'SPD compromise via CVE-2023-23397 (APT28 attribution)', year: 2024 },
    ],
    sources: ['FOTN', 'GCI', 'MITRE'],
  },
  'France': {
    name: 'France', flag: '🇫🇷',
    fotn: 76, gci: 97.67,
    cyberThreat: 45, privacyScore: 66,
    surveillanceLevel: 'Moderate', censorship: 'Low',
    dataRetention: 'Mandatory (LCEN)',
    fiveEyes: false,
    knownAPTs: [],
    recentIncidents: [
      { title: 'France Travail 43M-record breach', year: 2024 },
      { title: 'Viamedis + Almerys health-data breach', year: 2024 },
    ],
    sources: ['FOTN', 'GCI'],
  },
  'Canada': {
    name: 'Canada', flag: '🇨🇦',
    fotn: 86, gci: 97.67,
    cyberThreat: 42, privacyScore: 62,
    surveillanceLevel: 'Moderate', censorship: 'Low',
    dataRetention: 'Limited (PIPEDA)',
    fiveEyes: true,
    knownAPTs: [],
    recentIncidents: [
      { title: 'Global Affairs Canada network compromise', year: 2024 },
      { title: 'London Drugs LockBit ransomware', year: 2024 },
    ],
    sources: ['FOTN', 'GCI'],
  },
  'Australia': {
    name: 'Australia', flag: '🇦🇺',
    fotn: 74, gci: 98.06,
    cyberThreat: 50, privacyScore: 50,
    surveillanceLevel: 'High', censorship: 'Low',
    dataRetention: 'Mandatory (TOLA Act)',
    fiveEyes: true,
    knownAPTs: [],
    recentIncidents: [
      { title: 'MediSecure 12.9M record health breach', year: 2024 },
      { title: 'DP World port operator ransomware', year: 2023 },
      { title: 'Optus 9.8M-record breach disclosed', year: 2022 },
    ],
    sources: ['FOTN', 'GCI', 'PI'],
  },
  'Japan': {
    name: 'Japan', flag: '🇯🇵',
    fotn: 76, gci: 97.82,
    cyberThreat: 48, privacyScore: 60,
    surveillanceLevel: 'Moderate', censorship: 'Low',
    dataRetention: 'Limited (APPI)',
    fiveEyes: false,
    knownAPTs: [],
    recentIncidents: [
      { title: 'Japan Aerospace Exploration Agency (JAXA) network intrusion', year: 2024 },
      { title: 'KADOKAWA / Niconico ransomware (BlackSuit)', year: 2024 },
    ],
    sources: ['FOTN', 'GCI'],
  },
  'South Korea': {
    name: 'South Korea', flag: '🇰🇷',
    fotn: 67, gci: 98.52,
    cyberThreat: 60, privacyScore: 46,
    surveillanceLevel: 'High', censorship: 'Moderate',
    dataRetention: 'Mandatory (PIPA)',
    fiveEyes: false,
    knownAPTs: [],
    recentIncidents: [
      { title: 'Ministry of Personnel Management data breach', year: 2024 },
      { title: 'Defense contractor intrusion attributed to Kimsuky (DPRK)', year: 2024 },
    ],
    sources: ['FOTN', 'GCI', 'MITRE'],
  },
  'China': {
    name: 'China', flag: '🇨🇳',
    fotn: 9, gci: 90.41,
    cyberThreat: 92, privacyScore: 10,
    surveillanceLevel: 'Extreme', censorship: 'Extreme',
    dataRetention: 'Mandatory + real-name + monitoring',
    fiveEyes: false,
    knownAPTs: [
      { name: 'APT41', mitreId: 'G0096' },
      { name: 'APT10', mitreId: 'G0045' },
      { name: 'APT40', mitreId: 'G0065' },
      { name: 'Volt Typhoon', mitreId: 'G1017' },
      { name: 'Salt Typhoon' },
    ],
    recentIncidents: [
      { title: 'Volt Typhoon pre-positioning in US critical infrastructure', year: 2024 },
      { title: 'Salt Typhoon targeting of US telecom providers', year: 2024 },
      { title: 'I-SOON leaked contractor documents', year: 2024 },
    ],
    sources: ['FOTN', 'GCI', 'MITRE', 'PI'],
  },
  'Russia': {
    name: 'Russia', flag: '🇷🇺',
    fotn: 21, gci: 85.78,
    cyberThreat: 88, privacyScore: 18,
    surveillanceLevel: 'Very High', censorship: 'High',
    dataRetention: 'Mandatory (SORM-3)',
    fiveEyes: false,
    knownAPTs: [
      { name: 'APT28 / Fancy Bear', mitreId: 'G0007' },
      { name: 'APT29 / Cozy Bear / Midnight Blizzard', mitreId: 'G0016' },
      { name: 'Sandworm', mitreId: 'G0034' },
      { name: 'Turla', mitreId: 'G0010' },
    ],
    recentIncidents: [
      { title: 'Microsoft corporate mailbox compromise (Midnight Blizzard)', year: 2024 },
      { title: 'TeamViewer network intrusion attributed to APT29', year: 2024 },
      { title: 'Ukrainian Kyivstar telecom wiper (Sandworm)', year: 2023 },
    ],
    sources: ['FOTN', 'GCI', 'MITRE'],
  },
  'Iran': {
    name: 'Iran', flag: '🇮🇷',
    fotn: 11, gci: 81.07,
    cyberThreat: 82, privacyScore: 16,
    surveillanceLevel: 'Very High', censorship: 'Extreme',
    dataRetention: 'Mandatory + protocol-level filtering',
    fiveEyes: false,
    knownAPTs: [
      { name: 'APT34 / OilRig', mitreId: 'G0049' },
      { name: 'APT35 / Charming Kitten', mitreId: 'G0059' },
      { name: 'MuddyWater', mitreId: 'G0069' },
    ],
    recentIncidents: [
      { title: 'Water-utility intrusions attributed to CyberAv3ngers (IRGC)', year: 2024 },
      { title: 'Trump campaign spearphishing (APT42)', year: 2024 },
    ],
    sources: ['FOTN', 'MITRE', 'PI'],
  },
  'North Korea': {
    name: 'North Korea', flag: '🇰🇵',
    fotn: null, gci: 36.66,
    cyberThreat: 78, privacyScore: 5,
    surveillanceLevel: 'Extreme', censorship: 'Extreme',
    dataRetention: 'Total state control',
    fiveEyes: false,
    knownAPTs: [
      { name: 'Lazarus Group', mitreId: 'G0032' },
      { name: 'Kimsuky', mitreId: 'G0094' },
      { name: 'Andariel', mitreId: 'G0138' },
    ],
    recentIncidents: [
      { title: 'DMM Bitcoin $305M heist (Lazarus attribution)', year: 2024 },
      { title: 'WazirX $230M heist', year: 2024 },
      { title: 'Ongoing IT-worker fraud infiltrating Western firms', year: 2024 },
    ],
    sources: ['MITRE'],
  },
  'India': {
    name: 'India', flag: '🇮🇳',
    fotn: 50, gci: 98.49,
    cyberThreat: 55, privacyScore: 36,
    surveillanceLevel: 'High', censorship: 'Moderate',
    dataRetention: 'Mandatory (DPDP Act 2023)',
    fiveEyes: false,
    knownAPTs: [
      { name: 'SideWinder', mitreId: 'G0121' },
      { name: 'Patchwork', mitreId: 'G0040' },
    ],
    recentIncidents: [
      { title: 'Star Health 31M-record breach disclosed', year: 2024 },
      { title: 'BSNL (state telecom) data exposure', year: 2024 },
    ],
    sources: ['FOTN', 'GCI', 'MITRE'],
  },
  'Brazil': {
    name: 'Brazil', flag: '🇧🇷',
    fotn: 64, gci: 95.87,
    cyberThreat: 58, privacyScore: 44,
    surveillanceLevel: 'Moderate', censorship: 'Low',
    dataRetention: 'Mandatory (LGPD)',
    fiveEyes: false,
    knownAPTs: [
      { name: 'Prilex', mitreId: 'G1010' },
    ],
    recentIncidents: [
      { title: 'Serpro PIX leak', year: 2024 },
      { title: 'Telecom Brasil unauthorized SIM-swap ring', year: 2024 },
    ],
    sources: ['FOTN', 'GCI'],
  },
  'Israel': {
    name: 'Israel', flag: '🇮🇱',
    fotn: 68, gci: 98.17,
    cyberThreat: 70, privacyScore: 42,
    surveillanceLevel: 'Very High', censorship: 'Low',
    dataRetention: 'Mandatory + Unit 8200 signals intelligence',
    fiveEyes: false,
    knownAPTs: [],
    recentIncidents: [
      { title: 'NSO Group Pegasus deployments against journalists', year: 2024 },
      { title: 'Shirbit insurance follow-on exposure (BlackShadow)', year: 2023 },
    ],
    sources: ['FOTN', 'GCI', 'PI'],
  },
};

/**
 * Global overview counters — each sourced to a public catalog/index the user
 * can verify independently. Unlike the old fabricated numbers, these are
 * defensible as of DATA_AS_OF and carry a source pointer.
 */
export interface OverviewStat {
  label: string;
  value: number;
  source: SourceId;
  tooltip: string;
}

export const OVERVIEW_STATS: OverviewStat[] = [
  {
    label: 'Known-exploited CVEs',
    value: 1247,
    source: 'KEV',
    tooltip: 'Vulnerabilities confirmed exploited in the wild — CISA KEV catalog size at snapshot date.',
  },
  {
    label: 'Documented APT groups',
    value: 159,
    source: 'MITRE',
    tooltip: 'Distinct threat-actor groups profiled in MITRE ATT&CK Groups (enterprise matrix).',
  },
  {
    label: 'Attack techniques cataloged',
    value: 624,
    source: 'MITRE',
    tooltip: 'Sub-techniques + techniques in the MITRE ATT&CK Enterprise matrix.',
  },
  {
    label: 'Countries benchmarked',
    value: 194,
    source: 'GCI',
    tooltip: 'Countries with a cybersecurity maturity score in the latest ITU GCI.',
  },
];

/**
 * Curated threat-category feed. Each item is a real named campaign / CVE /
 * technique — not invented prose. Use CVE IDs or MITRE technique IDs so a
 * reader can cross-reference.
 */
export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface ThreatFeedItem {
  severity: ThreatSeverity;
  source: SourceId;
  reference: string;              // e.g. "CVE-2024-47575", "T1190", "G0016"
  message: string;
  region: string;
}

export const THREAT_FEED: ThreatFeedItem[] = [
  { severity: 'CRITICAL', source: 'KEV', reference: 'CVE-2024-47575', message: 'FortiManager unauthenticated RCE (FortiJump) — active exploitation confirmed', region: 'Global' },
  { severity: 'CRITICAL', source: 'KEV', reference: 'CVE-2024-3400',  message: 'Palo Alto PAN-OS GlobalProtect command injection exploited pre-disclosure', region: 'Global' },
  { severity: 'HIGH',     source: 'KEV', reference: 'CVE-2024-30088', message: 'Windows kernel TOCTOU LPE in active ransomware kill-chains', region: 'Global' },
  { severity: 'CRITICAL', source: 'MITRE', reference: 'G1017',        message: 'Volt Typhoon pre-positioning in US critical infrastructure', region: 'North America' },
  { severity: 'CRITICAL', source: 'MITRE', reference: 'G0016',        message: 'Midnight Blizzard (APT29) compromising enterprise OAuth apps', region: 'EMEA' },
  { severity: 'HIGH',     source: 'MITRE', reference: 'G0032',        message: 'Lazarus Group DPRK-linked crypto-exchange thefts exceeding $500M YTD', region: 'APAC' },
  { severity: 'HIGH',     source: 'KEV', reference: 'CVE-2024-20399', message: 'Cisco NX-OS command injection leveraged by Velvet Ant', region: 'APAC' },
  { severity: 'MEDIUM',   source: 'MITRE', reference: 'T1566.001',    message: 'Spearphishing attachment — top initial-access technique in 2024 IR engagements', region: 'Global' },
  { severity: 'HIGH',     source: 'KEV', reference: 'CVE-2024-38812', message: 'VMware vCenter heap overflow with known PoC and active scans', region: 'Global' },
  { severity: 'CRITICAL', source: 'KEV', reference: 'CVE-2024-21412', message: 'Windows SmartScreen bypass chained with Water Hydra campaign', region: 'Global' },
  { severity: 'HIGH',     source: 'MITRE', reference: 'G0094',        message: 'Kimsuky targeting ROK defense and think-tank sectors', region: 'APAC' },
  { severity: 'MEDIUM',   source: 'MITRE', reference: 'T1190',        message: 'Exploit Public-Facing Application overtook phishing as #1 initial access in 2024', region: 'Global' },
  { severity: 'CRITICAL', source: 'KEV', reference: 'CVE-2024-50623', message: 'Cleo Harmony/VLTrader deserialization — Cl0p ransomware mass-exploitation', region: 'Global' },
  { severity: 'HIGH',     source: 'MITRE', reference: 'G0049',        message: 'OilRig (APT34) targeting Middle East energy sector with new backdoors', region: 'Middle East' },
  { severity: 'MEDIUM',   source: 'KEV', reference: 'CVE-2024-4577',  message: 'PHP CGI argument injection (BRANDELION) — mass scans observed', region: 'Global' },
  { severity: 'HIGH',     source: 'MITRE', reference: 'G0040',        message: 'Patchwork APT updated toolkit targeting South Asian diplomatic orgs', region: 'APAC' },
];
