import { describe, it, expect } from 'vitest';
import { computeTotals } from './totals';
import type { LatestDataset } from '../types';

const source = (over: Record<string, unknown>) =>
  ({ id: 's', label: 'S', records: [], ...over }) as unknown as LatestDataset['sources'][number];

const dataset = (sources: unknown[]) =>
  ({ generatedAt: '2026-08-01T00:00:00.000Z', sources }) as unknown as LatestDataset;

describe('computeTotals', () => {
  it('returns zeroes with no dataset', () => {
    expect(computeTotals(null)).toEqual({ recordCount: 0, sourceCount: 0 });
    expect(computeTotals(undefined)).toEqual({ recordCount: 0, sourceCount: 0 });
  });

  it('counts the sources', () => {
    expect(computeTotals(dataset([source({}), source({})])).sourceCount).toBe(2);
  });

  // Regression: the hero showed 180 (embedded samples) while the source cards
  // beneath it showed 5,842 and 39,857.
  it('uses totalRecords rather than the embedded sample length', () => {
    const d = dataset([
      source({ totalRecords: 5842, records: new Array(100).fill({}) }),
      source({ totalRecords: 39857, records: new Array(80).fill({}) }),
    ]);

    expect(computeTotals(d).recordCount).toBe(45699);
  });

  it('falls back to the sample length when a source omits totalRecords', () => {
    const d = dataset([source({ records: new Array(7).fill({}) })]);
    expect(computeTotals(d).recordCount).toBe(7);
  });

  it('treats a source with neither field as zero', () => {
    const d = dataset([source({ records: undefined }), source({ totalRecords: 5 })]);
    expect(computeTotals(d).recordCount).toBe(5);
  });

  it('handles an empty source list', () => {
    expect(computeTotals(dataset([]))).toEqual({ recordCount: 0, sourceCount: 0 });
  });
});
