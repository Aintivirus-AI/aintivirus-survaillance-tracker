/**
 * One-shot dataset build, no server attached.
 *
 * The old deployment ran NestJS + BullMQ + Redis + SQLite on a VM to do what
 * is, at heart, a nightly batch job: run three connectors, produce one JSON
 * document. That VM died with the AWS account (and disk-full from its own
 * export archive took it down twice before that). This runner is the batch
 * job with the server removed: instantiate the connectors directly, collect,
 * assemble the exact LatestDataset shape the frontend consumes, write it to
 * disk. CI uploads it to R2; the site serves it from there.
 *
 * Resilience: if a connector fails, its block is carried over from the
 * previously published dataset (fetched from PREVIOUS_DATASET_URL) rather
 * than dropped, so one bad scrape night never blanks a source.
 *
 * Run: npx tsx src/standalone/run-once.ts
 * Env:
 *   OUT_PATH              where to write latest.json (default ./latest.json)
 *   GEOCODE_CACHE_PATH    JSON cache for Nominatim (default ./geocode-cache.json)
 *   PREVIOUS_DATASET_URL  published dataset to fall back on per-source
 */
import 'reflect-metadata';
import { promises as fs } from 'fs';

import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { AtlasOfSurveillanceConnector } from '../connectors/atlasofsurveillance.connector';
import { OverpassConnector } from '../connectors/overpass.connector';
import { RedlightCameraListConnector } from '../connectors/redlightcameralist.connector';
import { Connector, ConnectorResult } from '../connectors/connector.types';
import { NominatimGeocoder } from '../geocoding/nominatim.geocoder';
import { CachingGeocoder } from './caching-geocoder';

const OUT_PATH = process.env.OUT_PATH ?? './latest.json';
const GEOCODE_CACHE_PATH =
  process.env.GEOCODE_CACHE_PATH ?? './geocode-cache.json';
const PREVIOUS_DATASET_URL = process.env.PREVIOUS_DATASET_URL;

interface DatasetSourceBlock {
  key: string;
  title: string;
  description?: string;
  kind: string;
  homepage?: string;
  schedule?: string;
  lastIngestedAt?: string;
  lastRevision?: string;
  totalRecords: number;
  snapshot: {
    id: number;
    createdAt: string;
    revision?: string;
    recordCount: number;
  };
  records: Array<Record<string, unknown>>;
}

function toBlock(connector: Connector, result: ConnectorResult): DatasetSourceBlock {
  const iso = result.fetchedAt.toISOString();
  return {
    key: connector.metadata.id,
    title: connector.metadata.title,
    description: connector.metadata.description,
    kind: connector.metadata.kind,
    homepage: connector.metadata.homepage,
    schedule: connector.metadata.schedule,
    lastIngestedAt: iso,
    lastRevision: result.sourceRevision,
    totalRecords: result.records.length,
    snapshot: {
      id: result.fetchedAt.getTime(),
      createdAt: iso,
      revision: result.sourceRevision,
      recordCount: result.records.length,
    },
    records: result.records.map((r) => ({
      uid: r.uid,
      jurisdiction: r.jurisdiction ?? undefined,
      address: r.address ?? undefined,
      category: r.category ?? undefined,
      latitude: r.latitude ?? undefined,
      longitude: r.longitude ?? undefined,
      raw: r.raw ?? undefined,
    })),
  };
}

async function fetchPreviousBlocks(): Promise<Map<string, DatasetSourceBlock>> {
  const map = new Map<string, DatasetSourceBlock>();
  if (!PREVIOUS_DATASET_URL) return map;
  try {
    const { data } = await axios.get(PREVIOUS_DATASET_URL, {
      timeout: 120_000,
      maxContentLength: 200 * 1024 * 1024,
    });
    for (const source of data?.sources ?? []) {
      if (source?.key) map.set(source.key, source);
    }
    console.log(`  previous dataset loaded: ${map.size} sources available as fallback`);
  } catch (error) {
    console.warn(
      `  previous dataset unavailable (${error instanceof Error ? error.message : error}) — no per-source fallback this run`,
    );
  }
  return map;
}

async function main(): Promise<void> {
  const started = Date.now();
  const geocoder = new CachingGeocoder(
    new NominatimGeocoder(new ConfigService()),
    GEOCODE_CACHE_PATH,
  );
  const cached = await geocoder.load();
  console.log(`geocode cache: ${cached} entries`);

  const connectors: Connector[] = [
    new RedlightCameraListConnector(),
    new AtlasOfSurveillanceConnector(),
    // The runner's cache satisfies the same reverseGeocode contract.
    new OverpassConnector(geocoder as unknown as NominatimGeocoder),
  ];

  const previous = await fetchPreviousBlocks();
  const blocks: DatasetSourceBlock[] = [];
  const failures: string[] = [];

  for (const connector of connectors) {
    const id = connector.metadata.id;
    console.log(`[${id}] collecting...`);
    try {
      const result = await connector.collect({
        jobId: `standalone-${Date.now()}`,
        attempt: 1,
        scheduledFor: new Date(),
      });
      if (result.isFallback) {
        // A connector that fell back to bundled sample data did not actually
        // reach its source; prefer yesterday's real data over today's sample.
        const prev = previous.get(id);
        if (prev) {
          console.warn(`[${id}] returned fallback sample — keeping previous block (${prev.totalRecords} records)`);
          blocks.push(prev);
          failures.push(id);
          continue;
        }
      }
      console.log(`[${id}] ${result.records.length} records`);
      blocks.push(toBlock(connector, result));
    } catch (error) {
      failures.push(id);
      const prev = previous.get(id);
      if (prev) {
        console.warn(`[${id}] FAILED (${error instanceof Error ? error.message : error}) — carrying previous block (${prev.totalRecords} records)`);
        blocks.push(prev);
      } else {
        console.error(`[${id}] FAILED with no previous block to carry: ${error instanceof Error ? error.message : error}`);
      }
    } finally {
      // Persist whatever geocoding we paid for, even on a failed run.
      await geocoder.save();
    }
  }

  if (blocks.length === 0) {
    console.error('every connector failed and no previous dataset was available');
    process.exit(1);
  }

  blocks.sort((a, b) => a.title.localeCompare(b.title));
  const dataset = {
    generatedAt: new Date().toISOString(),
    sources: blocks,
  };
  await fs.writeFile(OUT_PATH, JSON.stringify(dataset));

  const bytes = (await fs.stat(OUT_PATH)).size;
  const totalRecords = blocks.reduce((sum, b) => sum + b.totalRecords, 0);
  console.log(
    `wrote ${OUT_PATH}: ${blocks.length} sources, ${totalRecords} records, ` +
      `${(bytes / 1048576).toFixed(1)} MB in ${Math.round((Date.now() - started) / 1000)}s` +
      (failures.length ? ` (carried: ${failures.join(', ')})` : ''),
  );
  // Partial success is success — the dataset is complete because failed
  // sources carried over — but signal it for the workflow log.
  if (failures.length === connectors.length) process.exit(1);
}

void main();
