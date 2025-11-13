import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { parse } from 'csv-parse/sync';
import {
  Connector,
  ConnectorMetadata,
  ConnectorResult,
  ConnectorRunContext,
  NormalizedRecord,
} from './connector.types';
import { slugify } from '../utils/slug';

interface AtlasSampleEntry {
  uid: string;
  title: string;
  jurisdiction: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  sourceUrl?: string;
}

const DEFAULT_ATLAS_URL =
  'https://www.atlasofsurveillance.org/download.csv?vendor=Flock+Safety';

type AtlasCsvRow = Record<string, string>;

@Injectable()
export class AtlasOfSurveillanceConnector implements Connector {
  readonly metadata: ConnectorMetadata = {
    id: 'atlas-of-surveillance',
    title: 'Atlas of Surveillance',
    description:
      'Imports crowd-sourced and reported surveillance datasets maintained by the EFF Atlas of Surveillance project.',
    kind: 'api',
    schedule: '0 0 * * *',
    homepage: 'https://atlasofsurveillance.org/',
  };

  private readonly logger = new Logger(AtlasOfSurveillanceConnector.name);
  private readonly http: AxiosInstance;
  private readonly fallback: AtlasSampleEntry[];

  constructor() {
    this.http = axios.create({
      timeout: 20000,
    });
    this.fallback = this.loadSampleEntries();
  }

  async collect(context: ConnectorRunContext): Promise<ConnectorResult> {
    try {
      const response = await this.http.get<string>(DEFAULT_ATLAS_URL, {
        responseType: 'text',
      });
      const csvBody = response.data ?? '';
      const records = this.parseCsv(csvBody);

      if (records.length === 0) {
        this.logger.warn(
          'Atlas of Surveillance returned zero records; falling back to sample dataset.',
        );
        return this.buildFallbackResult(context);
      }

      return {
        records,
        fetchedAt: new Date(),
        sourceRevision: records.length.toString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to fetch Atlas of Surveillance dataset (${errorMessage}); using fallback sample.`,
      );
      return this.buildFallbackResult(context);
    }
  }

  private parseCsv(csvBody: string): NormalizedRecord[] {
    if (!csvBody || csvBody.trim().length === 0) {
      return [];
    }
    let rows: AtlasCsvRow[];
    try {
      rows = parse(csvBody, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as AtlasCsvRow[];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Unable to parse Atlas of Surveillance CSV (${errorMessage}).`,
      );
      return [];
    }

    const records: NormalizedRecord[] = [];
    const seenBaseUids = new Map<string, number>();
    for (const row of rows) {
      const normalized = this.normalizeRow(row);
      if (!normalized) {
        continue;
      }
      const { baseUid, record } = normalized;
      const occurrence = seenBaseUids.get(baseUid) ?? 0;
      const finalUid = occurrence > 0 ? `${baseUid}-${occurrence + 1}` : baseUid;
      seenBaseUids.set(baseUid, occurrence + 1);

      records.push({
        ...record,
        uid: finalUid,
        raw: record.raw
          ? {
              ...record.raw,
              atlasBaseUid: baseUid,
              atlasDuplicateIndex: occurrence,
            }
          : {
              atlasBaseUid: baseUid,
              atlasDuplicateIndex: occurrence,
            },
      });
    }
    return records;
  }

  private normalizeRow(
    row: AtlasCsvRow,
  ):
    | {
        record: NormalizedRecord;
        baseUid: string;
      }
    | undefined {
    const city = this.pick(row, ['City']);
    const county = this.pick(row, ['County']);
    const state = this.pick(row, ['State']);
    const technology = this.pick(row, ['Technology']);
    const summary = this.pick(row, ['Summary']);
    const agency = this.pick(row, ['Agency']);
    const sourceUrl = this.pick(row, [
      'Link 1',
      'Link 2',
      'Link 3',
      'Other Links',
    ]);

    const locationParts = [city, county, state].filter((part): part is string =>
      Boolean(part),
    );
    const jurisdiction =
      locationParts.length > 0
        ? locationParts.join(', ')
        : 'Unknown Jurisdiction';

    const category =
      this.normalizeCategory(technology) ??
      this.inferCategory(summary ?? agency ?? 'Surveillance Record');

    const uidSource =
      this.pick(row, ['AOSNUMBER']) ??
      this.fingerprint(agency ?? summary ?? 'surveillance', jurisdiction);

    const baseUid = `${this.metadata.id}-${uidSource}`;

    return {
      baseUid,
      record: {
        uid: baseUid,
        sourceId: this.metadata.id,
        jurisdiction,
        category,
        address: summary ?? agency,
        raw: {
          agency,
          technology,
          summary,
          county,
          city,
          state,
          sourceUrl,
          row,
        },
      },
    };
  }

  private normalizeCategory(technology?: string): string | undefined {
    if (!technology || technology.trim().length === 0) {
      return undefined;
    }
    return this.inferCategory(technology);
  }

  private pick(row: AtlasCsvRow, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return undefined;
  }

  private inferCategory(title: string): string {
    const normalized = title.toLowerCase();
    if (normalized.includes('drone')) {
      return 'drone';
    }
    if (normalized.includes('license')) {
      return 'license_plate_reader';
    }
    if (normalized.includes('facial')) {
      return 'facial_recognition';
    }
    if (normalized.includes('camera')) {
      return 'camera';
    }
    return 'surveillance';
  }

  private fingerprint(title: string, jurisdiction: string): string {
    return slugify(`${title}-${jurisdiction}`);
  }

  private buildFallbackResult(context: ConnectorRunContext): ConnectorResult {
    const records: NormalizedRecord[] = this.fallback.map((entry) => ({
      uid: `${this.metadata.id}-${entry.uid}`,
      sourceId: this.metadata.id,
      jurisdiction: entry.jurisdiction,
      category: entry.category ?? 'surveillance',
      latitude: entry.latitude,
      longitude: entry.longitude,
      address: entry.title,
      raw: {
        sourceUrl: entry.sourceUrl,
      },
    }));

    return {
      records,
      fetchedAt: new Date(),
      sourceRevision: context.jobId,
      isFallback: true,
    };
  }

  private loadSampleEntries(): AtlasSampleEntry[] {
    try {
      const candidates = [
        join(__dirname, 'samples', 'atlasofsurveillance.sample.json'),
        join(
          process.cwd(),
          'src',
          'connectors',
          'samples',
          'atlasofsurveillance.sample.json',
        ),
      ];

      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          const raw = readFileSync(candidate, 'utf-8');
          return JSON.parse(raw) as AtlasSampleEntry[];
        }
      }

      throw new Error('Sample file not found in expected locations');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Unable to load Atlas of Surveillance sample data: ${message}`,
      );
      return [];
    }
  }
}
