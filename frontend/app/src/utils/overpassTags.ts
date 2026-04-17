import type { DatasetRecord } from '../types';

/**
 * Pull the string-valued `tags` object out of a record's `raw` payload.
 *
 * Overpass ALPR records carry OSM node tags like
 *   { operator: 'Flock Safety', manufacturer: 'Motorola', direction: '90', ... }
 * under `raw.tags`. Other sources don't have this shape — we return undefined.
 *
 * Only string-valued entries are preserved (OSM tags are always strings).
 */
export function getOverpassTags(record: DatasetRecord | null): Record<string, string> | undefined {
  if (!record) return undefined;
  const raw = record.raw;
  if (!raw || typeof raw !== 'object') return undefined;

  const candidate = (raw as Record<string, unknown>)['tags'];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;

  const entries = Object.entries(candidate).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

/**
 * Extract the `sourceUrl` link (e.g. to openstreetmap.org) from a record's raw payload.
 */
export function getRecordSourceUrl(record: DatasetRecord | null): string | undefined {
  if (!record) return undefined;
  const raw = record.raw;
  if (!raw || typeof raw !== 'object') return undefined;
  const value = (raw as Record<string, unknown>)['sourceUrl'];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Human-readable "lat, lon" string (5 decimal places) or undefined if coords missing.
 */
export function formatRecordCoordinates(record: DatasetRecord | null): string | undefined {
  if (!record) return undefined;
  if (
    typeof record.latitude !== 'number' ||
    !Number.isFinite(record.latitude) ||
    typeof record.longitude !== 'number' ||
    !Number.isFinite(record.longitude)
  ) {
    return undefined;
  }
  return `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`;
}
