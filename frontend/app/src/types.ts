export interface DatasetRecord {
  uid: string;
  jurisdiction?: string;
  address?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  raw?: Record<string, unknown>;
}

export interface DatasetSnapshot {
  id: string;
  createdAt: string;
  revision?: string;
  recordCount: number;
}

export interface DatasetSource {
  key: string;
  title: string;
  description?: string;
  kind: string;
  homepage?: string;
  schedule?: string;
  lastIngestedAt?: string | null;
  lastRevision?: string | null;
  totalRecords: number;
  snapshot: DatasetSnapshot;
  records: DatasetRecord[];
}

export interface LatestDataset {
  generatedAt: string;
  sources: DatasetSource[];
}

export type DatasetStatus = 'loading' | 'online' | 'offline' | 'cached' | 'error';

