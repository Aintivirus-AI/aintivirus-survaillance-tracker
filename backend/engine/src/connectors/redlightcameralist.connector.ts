import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  Connector,
  ConnectorMetadata,
  ConnectorResult,
  ConnectorRunContext,
  NormalizedRecord,
} from './connector.types';
import { slugify } from '../utils/slug';

const REDLIGHT_HOST = 'www.redlightcameralist.com';
const REDLIGHT_BASE_URL = `https://${REDLIGHT_HOST}`;
const REDLIGHT_ROOT_PATH = '/poi/United-States-of-America/';
const REDLIGHT_ROBOTS_PATH = '/robots.txt';
const DEFAULT_REQUEST_DELAY_MS = 200;
const MAX_DISCOVERY_DEPTH = 2;
const MAX_DISCOVERY_PAGES = 400;
const MAX_CITY_PAGE_REQUESTS = 25;
const DEFAULT_USER_AGENT =
  'SurveillanceTrackerBot/1.0 (+https://github.com/chand/aintivirus-survaillance-tracker)';
const REDLIGHT_DISPLAY_NAME = 'Red Light Cameras';

const STATE_ABBREVIATIONS: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
  'District Of Columbia': 'DC',
  'Puerto Rico': 'PR',
  'American Samoa': 'AS',
  Guam: 'GU',
  'Northern Mariana Islands': 'MP',
  'Virgin Islands': 'VI',
};

interface CityPageConfig {
  cityId: string;
  jurisdiction: string;
  url: string;
}

interface RedlightSampleEntry extends CityPageConfig {
  records: Array<{
    uid: string;
    address: string;
    latitude?: number;
    longitude?: number;
  }>;
}

@Injectable()
export class RedlightCameraListConnector implements Connector {
  readonly metadata: ConnectorMetadata = {
    id: 'redlightcameralist',
    title: REDLIGHT_DISPLAY_NAME,
    description:
      'Scrapes public intersection data across configured jurisdictions.',
    kind: 'scrape',
    schedule: '0 0 * * *',
    homepage: 'https://www.redlightcameralist.com/',
  };

  private readonly logger = new Logger(RedlightCameraListConnector.name);
  private readonly http: AxiosInstance;
  private readonly sampleEntries: RedlightSampleEntry[];
  private readonly staticCityConfigs: CityPageConfig[];
  private readonly fallbackMap: Map<string, RedlightSampleEntry>;
  private readonly discoveryRoots: string[] = [
    `${REDLIGHT_BASE_URL}${REDLIGHT_ROOT_PATH}`,
  ];
  private readonly requestDelayMs = DEFAULT_REQUEST_DELAY_MS;
  private readonly userAgentToken = DEFAULT_USER_AGENT.split(/[\/\s]/)[0].toLowerCase();
  private discoveredCityConfigs?: CityPageConfig[];
  private robotsRules: Array<{ pattern: RegExp; original: string }> | null =
    null;
  private robotsLoaded = false;

  constructor() {
    this.http = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
      },
    });
    this.sampleEntries = this.loadSampleEntries();
    this.staticCityConfigs = this.sampleEntries.map(
      ({ cityId, jurisdiction, url }) => ({
        cityId,
        jurisdiction,
        url,
      }),
    );
    this.fallbackMap = new Map(
      this.sampleEntries.map((entry) => [entry.cityId, entry]),
    );
  }

  async collect(context: ConnectorRunContext): Promise<ConnectorResult> {
    const cityConfigs = await this.resolveCityConfigs();
    if (cityConfigs.length === 0) {
      this.logger.warn(
        `No city configurations discovered or loaded for ${REDLIGHT_DISPLAY_NAME}.`,
      );
    } else {
      this.logger.debug(
        `Preparing to scrape ${cityConfigs.length} ${REDLIGHT_DISPLAY_NAME} cities.`,
      );
    }

    const records: NormalizedRecord[] = [];
    for (const city of cityConfigs) {
      try {
        const cityRecords = await this.collectCityRecords(city);
        if (cityRecords === null) {
          this.logger.debug(
            `Skipping ${city.cityId} because the page reports no listings.`,
          );
          continue;
        }

        if (cityRecords.length === 0) {
          this.logger.warn(
            `Parsed zero intersections for ${city.cityId}; using fallback sample dataset.`,
          );
          records.push(...this.fromFallback(city.cityId, city));
        } else {
          records.push(...cityRecords);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to fetch "${city.cityId}" from ${REDLIGHT_DISPLAY_NAME} (${errorMessage}); using fallback data.`,
        );
        records.push(...this.fromFallback(city.cityId, city));
      }
    }

    return {
      records,
      fetchedAt: new Date(),
      sourceRevision: context.jobId,
    };
  }

  private async collectCityRecords(
    city: CityPageConfig,
  ): Promise<NormalizedRecord[] | null> {
    const visited = new Set<string>();
    const enqueued = new Set<string>();
    const queue: string[] = [city.url];
    const deduped = new Map<string, NormalizedRecord>();
    let sawNoListings = false;

    while (queue.length > 0 && visited.size < MAX_CITY_PAGE_REQUESTS) {
      const pageUrl = queue.shift()!;
      if (visited.has(pageUrl)) {
        continue;
      }

      visited.add(pageUrl);

      let html: string;
      try {
        html = (await this.http.get<string>(pageUrl)).data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to fetch page "${pageUrl}" for ${city.cityId}: ${message}`,
        );
        continue;
      }

      const parsed = this.parseCityHtml(html, city);
      if (parsed === null) {
        sawNoListings = true;
      } else if (parsed.length > 0) {
        for (const record of parsed) {
          deduped.set(record.uid, record);
        }
      }

      const paginationUrls = this.extractCityPaginationUrls(html, city);
      for (const nextUrl of paginationUrls) {
        if (
          !visited.has(nextUrl) &&
          !enqueued.has(nextUrl) &&
          queue.length + visited.size < MAX_CITY_PAGE_REQUESTS
        ) {
          queue.push(nextUrl);
          enqueued.add(nextUrl);
        }
      }
    }

    if (deduped.size > 0) {
      return Array.from(deduped.values());
    }

    if (sawNoListings) {
      return null;
    }

    return [];
  }

  private extractCityPaginationUrls(
    html: string,
    city: CityPageConfig,
  ): string[] {
    const $ = cheerio.load(html);
    const urls = new Set<string>();

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) {
        return;
      }

      const normalized = this.normalizeUrl(city.url, href);
      if (!normalized) {
        return;
      }

      if (!normalized.startsWith(city.url)) {
        return;
      }

      if (normalized === city.url) {
        return;
      }

      urls.add(normalized);
    });

    return Array.from(urls);
  }

  private async resolveCityConfigs(): Promise<CityPageConfig[]> {
    if (this.discoveredCityConfigs) {
      return this.discoveredCityConfigs;
    }

    try {
      const discovered = await this.discoverCityConfigs();
      const merged = this.mergeCityConfigs(discovered);
      this.discoveredCityConfigs = merged;
      return merged;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Falling back to static ${REDLIGHT_DISPLAY_NAME} city configuration (${errorMessage}).`,
      );
      this.discoveredCityConfigs = [...this.staticCityConfigs];
      return this.discoveredCityConfigs;
    }
  }

  private mergeCityConfigs(discovered: CityPageConfig[]): CityPageConfig[] {
    const merged = new Map<string, CityPageConfig>();

    for (const config of this.staticCityConfigs) {
      merged.set(config.cityId, config);
    }

    for (const config of discovered) {
      merged.set(config.cityId, config);
    }

    return Array.from(merged.values()).sort((a, b) =>
      a.jurisdiction.localeCompare(b.jurisdiction),
    );
  }

  private async discoverCityConfigs(): Promise<CityPageConfig[]> {
    await this.ensureRobotsRules();

    const discovered = new Map<string, CityPageConfig>();
    const visited = new Set<string>();
    const enqueued = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [];

    for (const root of this.discoveryRoots) {
      queue.push({ url: root, depth: 0 });
      enqueued.add(root);
    }

    let pagesProcessed = 0;

    while (queue.length > 0 && pagesProcessed < MAX_DISCOVERY_PAGES) {
      const current = queue.shift()!;
      if (visited.has(current.url)) {
        continue;
      }

      visited.add(current.url);

      if (!(await this.isAllowedByRobots(current.url))) {
        this.logger.debug(
          `Skipping discovery URL ${current.url} due to robots.txt rules.`,
        );
        continue;
      }

      if (pagesProcessed > 0 && this.requestDelayMs > 0) {
        await this.delay(this.requestDelayMs);
      }

      let html: string;
      try {
        const response = await this.http.get<string>(current.url);
        html = response.data;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.debug(
          `Failed to fetch discovery URL ${current.url}: ${errorMessage}`,
        );
        continue;
      }

      pagesProcessed += 1;

      const $ = cheerio.load(html);
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) {
          return;
        }

        const normalizedUrl = this.normalizeUrl(current.url, href);
        if (!normalizedUrl) {
          return;
        }

        if (!normalizedUrl.startsWith(REDLIGHT_BASE_URL)) {
          return;
        }

        const cityConfig = this.parseCityUrl(normalizedUrl);
        if (cityConfig) {
          if (!discovered.has(cityConfig.cityId)) {
            discovered.set(cityConfig.cityId, cityConfig);
          }
          return;
        }

        if (current.depth + 1 > MAX_DISCOVERY_DEPTH) {
          return;
        }

        if (!this.shouldFollow(normalizedUrl)) {
          return;
        }

        if (!visited.has(normalizedUrl) && !enqueued.has(normalizedUrl)) {
          queue.push({ url: normalizedUrl, depth: current.depth + 1 });
          enqueued.add(normalizedUrl);
        }
      });
    }

    if (pagesProcessed >= MAX_DISCOVERY_PAGES) {
      this.logger.warn(
        `Reached discovery page limit (${MAX_DISCOVERY_PAGES}) while crawling ${REDLIGHT_DISPLAY_NAME}.`,
      );
    }

    if (discovered.size > 0) {
      this.logger.debug(
        `Discovered ${discovered.size} ${REDLIGHT_DISPLAY_NAME} city pages via crawl.`,
      );
    }

    return Array.from(discovered.values());
  }

  private normalizeUrl(baseUrl: string, href: string): string | null {
    const trimmed = href.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (trimmed.startsWith('#')) {
      return null;
    }
    if (/^(mailto|tel):/i.test(trimmed)) {
      return null;
    }

    try {
      const resolved = new URL(trimmed, baseUrl);
      if (resolved.hostname !== REDLIGHT_HOST) {
        return null;
      }
      resolved.hash = '';
      if (resolved.search) {
        resolved.search = '';
      }
      return this.ensureTrailingSlash(`${resolved.origin}${resolved.pathname}`);
    } catch {
      return null;
    }
  }

  private shouldFollow(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== REDLIGHT_HOST) {
        return false;
      }
      if (!parsed.pathname.startsWith(REDLIGHT_ROOT_PATH)) {
        return false;
      }
      if (this.parseCityUrl(url)) {
        return false;
      }
      const segments = parsed.pathname.split('/').filter(Boolean);
      return segments.length <= 3;
    } catch {
      return false;
    }
  }

  private parseCityUrl(url: string): CityPageConfig | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== REDLIGHT_HOST) {
        return null;
      }
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length !== 4) {
        return null;
      }
      if (segments[0] !== 'poi' || segments[1] !== 'United-States-of-America') {
        return null;
      }

      const stateName = this.decodeSegment(segments[2]);
      const cityName = this.decodeSegment(segments[3]);
      const stateAbbreviation = STATE_ABBREVIATIONS[stateName];
      const jurisdictionSuffix = stateAbbreviation ?? stateName;
      const cityId = slugify(`${cityName} ${jurisdictionSuffix}`);

      return {
        cityId,
        jurisdiction: `${cityName}, ${jurisdictionSuffix}`,
        url: this.ensureTrailingSlash(parsed.origin + parsed.pathname),
      };
    } catch {
      return null;
    }
  }

  private decodeSegment(segment: string): string {
    const withSpaces = decodeURIComponent(segment.replace(/-/g, ' '));
    return this.toTitleCase(withSpaces);
  }

  private toTitleCase(value: string): string {
    return value
      .split(/\s+/)
      .filter((part) => part.length > 0)
      .map(
        (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
      )
      .join(' ');
  }

  private ensureTrailingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
  }

  private async ensureRobotsRules(): Promise<void> {
    if (this.robotsLoaded) {
      return;
    }

    this.robotsLoaded = true;

    try {
      const response = await this.http.get<string>(
        `${REDLIGHT_BASE_URL}${REDLIGHT_ROBOTS_PATH}`,
      );
      this.robotsRules = this.parseRobots(response.data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `Unable to load robots.txt from ${REDLIGHT_DISPLAY_NAME} (${errorMessage}); proceeding without discovery guard.`,
      );
      this.robotsRules = null;
    }
  }

  private parseRobots(
    content: string,
  ): Array<{ pattern: RegExp; original: string }> {
    const lines = content.split(/\r?\n/);
    const rulesByAgent = new Map<string, string[]>();
    let currentAgent: string | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith('#')) {
        continue;
      }
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) {
        continue;
      }
      const directive = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();

      if (directive === 'user-agent') {
        currentAgent = value.toLowerCase();
        if (!rulesByAgent.has(currentAgent)) {
          rulesByAgent.set(currentAgent, []);
        }
      } else if (directive === 'disallow' && currentAgent) {
        rulesByAgent.get(currentAgent)?.push(value);
      }
    }

    const relevantAgents = [
      this.userAgentToken,
      '*',
    ];

    for (const agent of relevantAgents) {
      const rules = rulesByAgent.get(agent);
      if (rules && rules.length > 0) {
        return rules
          .filter((rule) => rule.length > 0)
          .map((rule) => ({
            original: rule,
            pattern: this.compileRobotsRule(rule),
          }));
      }
    }

    return [];
  }

  private async isAllowedByRobots(url: string): Promise<boolean> {
    await this.ensureRobotsRules();

    if (this.robotsRules === null) {
      return true;
    }

    const rules = this.robotsRules;
    if (!rules || rules.length === 0) {
      return true;
    }

    try {
      const path = new URL(url).pathname;
      return !rules.some((rule) => rule.pattern.test(path));
    } catch {
      return true;
    }
  }

  private compileRobotsRule(rule: string): RegExp {
    const endsWithDollar = rule.endsWith('$');
    const baseRule = endsWithDollar ? rule.slice(0, -1) : rule;
    const escaped = baseRule
      .split('*')
      .map((segment) => this.escapeRegex(segment))
      .join('.*');

    return new RegExp(`^${escaped}${endsWithDollar ? '$' : ''}`);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseCityHtml(
    html: string,
    city: CityPageConfig,
  ): NormalizedRecord[] | null {
    const $ = cheerio.load(html);

    if (this.hasNoListingsMessage($)) {
      return null;
    }

    const attributeRecords = this.parseFromDataAttributes($, city);
    if (attributeRecords.length > 0) {
      return attributeRecords;
    }

    const parsedRecords: NormalizedRecord[] = [];
    const candidateSelectors = [
      '#poi-list li',
      '.poi-list li',
      '.poi-results li',
      '.poiItem',
    ];
    let matches: cheerio.Cheerio<any> | null = null;

    for (const selector of candidateSelectors) {
      const found = $(selector);
      if (found.length > 0) {
        matches = found;
        break;
      }
    }

    if (!matches || matches.length === 0) {
      const fallbackRecords: NormalizedRecord[] = [];
      // Attempt to parse textual content blocks as a fallback.
      const textContent =
        $('#poi-list').text() || $('.poi-list').text() || $('main').text();
      const intersections = textContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => this.isLikelyIntersection(line));

      for (const intersection of intersections) {
        fallbackRecords.push(
          this.buildRecord(
            city,
            intersection,
            `fallback-${slugify(intersection)}`,
          ),
        );
      }

      if (fallbackRecords.length === 0) {
        return this.fromFallback(city.cityId, city);
      }

      return fallbackRecords;
    }

    matches.each((index, element) => {
      const record = this.extractRecordFromElement($(element), city, index);
      if (record) {
        parsedRecords.push(record);
      }
    });

    if (parsedRecords.length > 0) {
      const filtered = parsedRecords.filter((record) => {
        const address = record.address?.trim().toLowerCase() ?? '';
        if (address.length === 0) {
          return false;
        }
        if (address.startsWith('»')) {
          return false;
        }
        if (address.includes('locations for')) {
          return false;
        }
        if (address.includes('poi')) {
          return false;
        }
        if (address === 'list') {
          return false;
        }
        return true;
      });

      if (filtered.length > 0) {
        return filtered;
      }

      return parsedRecords;
    }

    const dataAttributeMatches = this.parseFromDataAttributes($, city);
    if (dataAttributeMatches.length > 0) {
      return dataAttributeMatches;
    }

    return parsedRecords;
  }

  private hasNoListingsMessage($: cheerio.CheerioAPI): boolean {
    const message = 'no listings at the moment.';
    const candidates = [
      $('#poi-list').text(),
      $('.poi-list').text(),
      $('main').text(),
      $('body').text(),
    ];

    return candidates.some((text) =>
      text?.toLowerCase().includes(message),
    );
  }

  private parseFromDataAttributes(
    $: cheerio.CheerioAPI,
    city: CityPageConfig,
  ): NormalizedRecord[] {
    const records: NormalizedRecord[] = [];
    const seen = new Set<string>();
    const selectors = [
      '[data-lat]',
      '[data-lng]',
      '[data-long]',
      '[data-lon]',
      '[data-latitude]',
      '[data-longitude]',
    ].join(',');

    $(selectors).each((index, element) => {
      const record = this.extractRecordFromElement($(element), city, index);
      if (record && !seen.has(record.uid)) {
        seen.add(record.uid);
        records.push(record);
      }
    });

    return records;
  }

  private extractRecordFromElement(
    element: cheerio.Cheerio<any>,
    city: CityPageConfig,
    index: number,
  ): NormalizedRecord | null {
    const addressAttr = this.findAttribute(element, [
      'data-addr',
      'data-address',
      'data-location',
      'data-title',
      'data-label',
    ]);

    const fallbackText = addressAttr?.node
      ? addressAttr.node.text().trim()
      : element.text().trim();
    const addressCandidate = (addressAttr?.value ?? fallbackText).trim();
    if (addressCandidate.length === 0) {
      return null;
    }

    const idAttr = this.findAttribute(element, [
      'data-id',
      'data-uid',
      'data-key',
    ]);
    const addressSlug = slugify(addressCandidate);
    const fallbackUidBase =
      addressSlug.length > 0
        ? `${slugify(city.cityId)}-${addressSlug}`
        : `${slugify(city.cityId)}-${index}`;
    const providedUid = idAttr?.value ? slugify(idAttr.value) : undefined;
    const uidSuffix =
      providedUid && providedUid.length > 0 ? providedUid : fallbackUidBase;

    const latitudeAttr = this.findAttribute(element, [
      'data-lat',
      'data-latitude',
      'data-y',
    ]);
    const longitudeAttr = this.findAttribute(element, [
      'data-lng',
      'data-long',
      'data-lon',
      'data-longitude',
      'data-x',
    ]);

    const latitude = this.parseCoordinate(latitudeAttr?.value);
    const longitude = this.parseCoordinate(longitudeAttr?.value);

    return this.buildRecord(
      city,
      addressCandidate,
      uidSuffix,
      latitude,
      longitude,
    );
  }

  private findAttribute(
    element: cheerio.Cheerio<any>,
    attributeNames: string[],
  ): { value: string; node: cheerio.Cheerio<any> } | null {
    for (const name of attributeNames) {
      const rawValue = element.attr(name);
      if (rawValue && rawValue.trim().length > 0) {
        return { value: rawValue.trim(), node: element };
      }
    }

    const selector = attributeNames.map((name) => `[${name}]`).join(',');
    if (selector.length === 0) {
      return null;
    }

    const match = element.find(selector).first();
    if (match.length === 0) {
      return null;
    }

    for (const name of attributeNames) {
      const rawValue = match.attr(name);
      if (rawValue && rawValue.trim().length > 0) {
        return { value: rawValue.trim(), node: match };
      }
    }

    return null;
  }

  private parseCoordinate(rawValue?: string): number | undefined {
    if (!rawValue) {
      return undefined;
    }

    const parsed = Number.parseFloat(rawValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private fromFallback(
    cityId: string,
    city: CityPageConfig,
  ): NormalizedRecord[] {
    const fallback = this.fallbackMap.get(cityId);
    if (!fallback) {
      this.logger.warn(`No fallback data configured for ${cityId}`);
      return [];
    }

    return fallback.records.map((record) =>
      this.buildRecord(
        city,
        record.address,
        record.uid ?? slugify(`${city.cityId}-${record.address}`),
        record.latitude,
        record.longitude,
      ),
    );
  }

  private cleanAddress(address: string, jurisdiction: string): string {
    let value = address.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();

    value = value
      .replace(/,\s*red light camera\b/gi, '')
      .replace(/\bred light camera\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/,\s*,/g, ', ')
      .replace(/,\s*$/, '');

    const trimmedJurisdiction = jurisdiction.trim();
    if (trimmedJurisdiction.length > 0) {
      const suffix = `, ${trimmedJurisdiction}`;
      const escapedSuffix = this.escapeRegex(suffix);
      const duplicateSuffixPattern = new RegExp(
        `(?:${escapedSuffix}){2,}$`,
        'i',
      );
      value = value.replace(duplicateSuffixPattern, suffix);
    }

    return value.trim();
  }

  private buildRecord(
    city: CityPageConfig,
    address: string,
    uidSuffix: string,
    latitude?: number,
    longitude?: number,
  ): NormalizedRecord {
    const cleanedAddress = this.cleanAddress(address, city.jurisdiction);

    return {
      uid: `${this.metadata.id}-${uidSuffix}`,
      sourceId: this.metadata.id,
      jurisdiction: city.jurisdiction,
      address: cleanedAddress,
      latitude,
      longitude,
      category: 'redlight_camera',
      raw: {
        cityId: city.cityId,
      },
    };
  }

  private isLikelyIntersection(value: string): boolean {
    const normalized = value.toLowerCase();
    if (normalized.length < 4) {
      return false;
    }

    if (
      normalized.includes('&') ||
      normalized.includes(' at ') ||
      normalized.includes(' / ') ||
      normalized.includes('@')
    ) {
      return true;
    }

    if (normalized.includes(' and ') && normalized.includes(',')) {
      return true;
    }

    return false;
  }

  private loadSampleEntries(): RedlightSampleEntry[] {
    try {
      const candidates = [
        join(__dirname, 'samples', 'redlightcameralist.sample.json'),
        join(
          process.cwd(),
          'src',
          'connectors',
          'samples',
          'redlightcameralist.sample.json',
        ),
      ];

      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          const raw = readFileSync(candidate, 'utf-8');
          return JSON.parse(raw) as RedlightSampleEntry[];
        }
      }

      throw new Error('Sample file not found in expected locations');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Unable to load Redlight sample data: ${message}`);
      return [];
    }
  }
}
