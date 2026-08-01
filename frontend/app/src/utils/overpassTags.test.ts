import { describe, it, expect } from 'vitest';
import {
  getOverpassTags,
  getRecordSourceUrl,
  formatRecordCoordinates,
} from './overpassTags';
import type { DatasetRecord } from '../types';

const record = (over: Partial<DatasetRecord> = {}): DatasetRecord =>
  ({ uid: 'r1', ...over }) as DatasetRecord;

describe('getOverpassTags', () => {
  it('extracts string tags from an OSM record', () => {
    const tags = getOverpassTags(record({
      raw: { tags: { operator: 'Flock Safety', manufacturer: 'Motorola' } },
    } as Partial<DatasetRecord>));

    expect(tags).toEqual({ operator: 'Flock Safety', manufacturer: 'Motorola' });
  });

  // OSM tag values are always strings; anything else is a different shape and
  // would render as "[object Object]" if passed through.
  it('drops non-string values', () => {
    const tags = getOverpassTags(record({
      raw: { tags: { operator: 'Flock', count: 3, nested: { a: 1 }, list: [1, 2] } },
    } as Partial<DatasetRecord>));

    expect(tags).toEqual({ operator: 'Flock' });
  });

  it('returns undefined when no string tags remain', () => {
    expect(getOverpassTags(record({ raw: { tags: { count: 3 } } } as Partial<DatasetRecord>))).toBeUndefined();
  });

  it.each([
    ['null record', null],
    ['no raw', record()],
    ['raw is a string', record({ raw: 'nope' as unknown as Record<string, unknown> })],
    ['no tags key', record({ raw: { other: 1 } } as Partial<DatasetRecord>)],
    ['tags is an array', record({ raw: { tags: ['a', 'b'] } } as Partial<DatasetRecord>)],
    ['tags is a string', record({ raw: { tags: 'operator' } } as Partial<DatasetRecord>)],
    ['empty tags', record({ raw: { tags: {} } } as Partial<DatasetRecord>)],
  ])('returns undefined for %s', (_label, input) => {
    expect(getOverpassTags(input as DatasetRecord | null)).toBeUndefined();
  });
});

describe('getRecordSourceUrl', () => {
  it('returns the sourceUrl when present', () => {
    expect(getRecordSourceUrl(record({
      raw: { sourceUrl: 'https://openstreetmap.org/node/1' },
    } as Partial<DatasetRecord>))).toBe('https://openstreetmap.org/node/1');
  });

  it.each([
    ['null record', null],
    ['no raw', record()],
    ['non-string sourceUrl', record({ raw: { sourceUrl: 42 } } as Partial<DatasetRecord>)],
    ['missing key', record({ raw: {} } as Partial<DatasetRecord>)],
  ])('returns undefined for %s', (_label, input) => {
    expect(getRecordSourceUrl(input as DatasetRecord | null)).toBeUndefined();
  });
});

describe('formatRecordCoordinates', () => {
  it('formats a coordinate pair', () => {
    const out = formatRecordCoordinates(record({ latitude: 51.507351, longitude: -0.127758 }));
    expect(out).toMatch(/^51\.50735, -0\.12776$/);
  });

  it('handles the origin and negative values', () => {
    expect(formatRecordCoordinates(record({ latitude: 0, longitude: 0 }))).toBe('0.00000, 0.00000');
    expect(formatRecordCoordinates(record({ latitude: -33.8688, longitude: 151.2093 })))
      .toBe('-33.86880, 151.20930');
  });

  it.each([
    ['null record', null],
    ['missing coords', record()],
    ['only latitude', record({ latitude: 10 })],
    ['only longitude', record({ longitude: 10 })],
    ['NaN latitude', record({ latitude: NaN, longitude: 10 })],
    ['Infinite longitude', record({ latitude: 10, longitude: Infinity })],
    ['string coords', record({ latitude: '10' as unknown as number, longitude: 10 })],
  ])('returns undefined for %s', (_label, input) => {
    expect(formatRecordCoordinates(input as DatasetRecord | null)).toBeUndefined();
  });
});
