import type { LatestDataset } from '../types';

export interface DatasetTotals {
  recordCount: number;
  sourceCount: number;
}

/**
 * Headline counts for the hero stats.
 *
 * `source.records` is only the sample the API embeds in the payload, so summing
 * its length undercounts badly — the hero read "180" while the source cards
 * directly beneath it added up to 45,699. `totalRecords` is the authoritative
 * figure and is what the cards already render; fall back to the sample length
 * only when a source omits it.
 */
export function computeTotals(dataset: LatestDataset | null | undefined): DatasetTotals {
  if (!dataset?.sources) {
    return { recordCount: 0, sourceCount: 0 };
  }

  const recordCount = dataset.sources.reduce(
    (sum, source) => sum + (source.totalRecords ?? source.records?.length ?? 0),
    0,
  );

  return { recordCount, sourceCount: dataset.sources.length };
}
