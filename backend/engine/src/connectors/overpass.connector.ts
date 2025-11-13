import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { SingleBar, Presets } from 'cli-progress';
import {
  Connector,
  ConnectorMetadata,
  ConnectorResult,
  ConnectorRunContext,
  NormalizedRecord,
} from './connector.types';
import {
  NominatimGeocoder,
  ReverseGeocodeResult,
} from '../geocoding/nominatim.geocoder';

interface OverpassNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: Array<
    OverpassNode & {
      type?: string;
    }
  >;
  osm3s?: {
    timestamp_osm_base?: string;
    timestamp_areas_base?: string;
  };
}

interface OverpassSampleEntry extends OverpassNode {}

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const OVERPASS_QUERY = `
[out:json][timeout:60];
area["ISO3166-1"="US"]->.usa;
(
  node
    ["man_made"="surveillance"]
    ["surveillance"="public"]
    ["surveillance:zone"="traffic"]
    ["surveillance:type"="ALPR"]
    ["camera:type"="fixed"]
    ["manufacturer:wikidata"="Q108485435"]
    (area.usa);
);
out body;
>;
out skel qt;
`;
const DEFAULT_ADDRESS_LABEL = 'ALPR surveillance node';

@Injectable()
export class OverpassConnector implements Connector {
  readonly metadata: ConnectorMetadata = {
    id: 'overpass-alpr',
    title: 'OpenStreetMap ALPR Surveillance',
    description:
      'Imports OpenStreetMap nodes tagged as ALPR surveillance equipment via the Overpass API.',
    kind: 'api',
    schedule: '0 0 * * *',
    homepage: 'https://overpass-turbo.eu/',
  };

  private readonly logger = new Logger(OverpassConnector.name);
  private readonly http: AxiosInstance;
  private readonly fallback: OverpassSampleEntry[];

  constructor(private readonly geocoder: NominatimGeocoder) {
    this.http = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    this.fallback = this.loadSampleEntries();
  }

  async collect(context: ConnectorRunContext): Promise<ConnectorResult> {
    try {
      const payload = new URLSearchParams();
      payload.set('data', OVERPASS_QUERY.trim());

      const response = await this.http.post<OverpassResponse>(
        OVERPASS_ENDPOINT,
        payload.toString(),
      );

      const nodes = this.extractNodes(response.data);
      const records = await this.buildRecords(nodes);

      if (records.length === 0) {
        this.logger.warn(
          'Overpass API returned zero ALPR surveillance nodes; using fallback dataset.',
        );
        return this.buildFallbackResult(context);
      }

      const sourceRevision =
        response.data?.osm3s?.timestamp_osm_base ??
        response.data?.osm3s?.timestamp_areas_base;

      return {
        records,
        fetchedAt: new Date(),
        sourceRevision,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to fetch Overpass ALPR dataset (${errorMessage}); using fallback sample.`,
      );
      return this.buildFallbackResult(context);
    }
  }

  private extractNodes(response: OverpassResponse | undefined): OverpassNode[] {
    if (!response?.elements || !Array.isArray(response.elements)) {
      return [];
    }

    return response.elements
      .filter(
        (element): element is OverpassNode =>
          element.type === 'node' &&
          typeof element.lat === 'number' &&
          Number.isFinite(element.lat) &&
          typeof element.lon === 'number' &&
          Number.isFinite(element.lon),
      )
      .map((node) => ({
        id: node.id,
        lat: node.lat,
        lon: node.lon,
        tags: node.tags,
      }));
  }

  private async buildRecords(
    nodes: OverpassNode[],
    options?: { allowReverseGeocode?: boolean },
  ): Promise<NormalizedRecord[]> {
    const allowReverseGeocode = options?.allowReverseGeocode ?? true;
    const geocodeTargets = allowReverseGeocode
      ? nodes.filter((node) => this.shouldReverseGeocode(node))
      : [];
    const totalTargets = geocodeTargets.length;
    const progressBar = this.createProgressBar(totalTargets);

    const records: NormalizedRecord[] = [];
    let completedTargets = 0;

    try {
      for (const node of nodes) {
        const shouldReverse =
          allowReverseGeocode && this.shouldReverseGeocode(node);
        const record = await this.toRecord(node, {
          allowReverseGeocode,
          forceReverseGeocode: shouldReverse,
        });
        if (shouldReverse && progressBar) {
          completedTargets += 1;
          progressBar.update(completedTargets, {
            remaining: totalTargets - completedTargets,
          });
        }
        records.push(record);
      }
    } finally {
      progressBar?.stop();
    }

    return records;
  }

  private async toRecord(
    node: OverpassNode,
    options?: { allowReverseGeocode?: boolean; forceReverseGeocode?: boolean },
  ): Promise<NormalizedRecord> {
    const {
      tags,
      city: tagCity,
      state: tagState,
      country: tagCountry,
      address: tagAddress,
    } = this.extractTagMetadata(node);
    const allowReverseGeocode = options?.allowReverseGeocode ?? true;
    const needsReverseGeocode =
      allowReverseGeocode &&
      (options?.forceReverseGeocode ??
        (!tagCity || !tagState || !tagAddress));

    let reverseGeocode: ReverseGeocodeResult | undefined;
    if (needsReverseGeocode) {
      reverseGeocode = await this.geocoder.reverseGeocode({
        latitude: node.lat,
        longitude: node.lon,
      });
    }

    const resolvedCity =
      tagCity ?? reverseGeocode?.city ?? reverseGeocode?.county;
    const resolvedState = tagState ?? reverseGeocode?.state;
    const resolvedCountry =
      tagCountry ??
      reverseGeocode?.country ??
      (reverseGeocode?.countryCode === 'US'
        ? 'United States'
        : undefined) ??
      'United States';

    const addressCandidates: Array<string | undefined> = [];
    if (reverseGeocode) {
      addressCandidates.push(reverseGeocode.formattedAddress);
      addressCandidates.push(
        this.combineStreet(
          reverseGeocode.houseNumber,
          reverseGeocode.road,
        ),
      );
    }
    addressCandidates.push(tagAddress);

    const address =
      this.pickFirst(addressCandidates, DEFAULT_ADDRESS_LABEL) ??
      DEFAULT_ADDRESS_LABEL;

    const jurisdictionParts = [resolvedCity, resolvedState].filter(
      (part): part is string => Boolean(part && part.trim().length > 0),
    );
    const jurisdiction =
      jurisdictionParts.length > 0
        ? jurisdictionParts.join(', ')
        : resolvedCountry;

    return {
      uid: `${this.metadata.id}-${node.id}`,
      sourceId: this.metadata.id,
      jurisdiction,
      address,
      latitude: node.lat,
      longitude: node.lon,
      category: 'license_plate_reader',
      raw: {
        id: node.id,
        tags,
        sourceUrl: this.buildOsmUrl(node.id),
        ...(reverseGeocode ? { reverseGeocode } : {}),
      },
    };
  }

  private extractTagMetadata(node: OverpassNode): {
    tags: Record<string, string>;
    city?: string;
    state?: string;
    country?: string;
    address?: string;
  } {
    const tags: Record<string, string> = node.tags ?? {};
    const city =
      tags['addr:city'] ??
      tags['is_in:city'] ??
      tags['addr:town'] ??
      tags['addr:hamlet'] ??
      tags['city'];
    const state =
      tags['addr:state'] ??
      tags['is_in:state_code'] ??
      tags['addr:province'] ??
      tags['state'];
    const country = tags['addr:country'] ?? tags['country'];
    const address = this.pickFirst([
      tags.name,
      tags['addr:full'],
      this.combineStreet(tags['addr:housenumber'], tags['addr:street']),
      tags['surveillance:monitoring'],
      tags.operator,
    ]);

    return { tags, city, state, country, address };
  }

  private shouldReverseGeocode(node: OverpassNode): boolean {
    const { city, state, address } = this.extractTagMetadata(node);
    return !city || !state || !address;
  }

  private createProgressBar(total: number): SingleBar | undefined {
    if (total <= 0) {
      return undefined;
    }

    const bar = new SingleBar(
      {
        format:
          'Nominatim reverse geocoding |{bar}| {value}/{total} processed ({remaining} left)',
        hideCursor: true,
        autopadding: true,
      },
      Presets.shades_classic,
    );
    bar.start(total, 0, { remaining: total });
    return bar;
  }

  private combineStreet(
    houseNumber?: string,
    street?: string,
  ): string | undefined {
    const parts = [houseNumber, street]
      .map((part) => (part && part.trim().length > 0 ? part.trim() : undefined))
      .filter((part): part is string => Boolean(part));
    if (parts.length === 0) {
      return undefined;
    }
    return parts.join(' ');
  }

  private pickFirst(
    candidates: Array<string | undefined>,
    fallback?: string,
  ): string | undefined {
    for (const candidate of candidates) {
      if (candidate && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return fallback;
  }

  private buildOsmUrl(id: number): string {
    return `https://www.openstreetmap.org/node/${id}`;
  }

  private async buildFallbackResult(
    context: ConnectorRunContext,
  ): Promise<ConnectorResult> {
    const records = await this.buildRecords(this.fallback, {
      allowReverseGeocode: false,
    });

    return {
      records,
      fetchedAt: new Date(),
      sourceRevision: context.jobId,
      isFallback: true,
    };
  }

  private loadSampleEntries(): OverpassSampleEntry[] {
    try {
      const candidates = [
        join(__dirname, 'samples', 'overpass.sample.json'),
        join(
          process.cwd(),
          'src',
          'connectors',
          'samples',
          'overpass.sample.json',
        ),
      ];

      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          const raw = readFileSync(candidate, 'utf-8');
          return JSON.parse(raw) as OverpassSampleEntry[];
        }
      }

      throw new Error('Sample file not found in expected locations');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Unable to load Overpass sample data: ${message}`);
      return [];
    }
  }
}


