export type ConnectorKind = 'scrape' | 'api' | 'static';

export interface ConnectorMetadata {
  id: string;
  title: string;
  description?: string;
  kind: ConnectorKind;
  // Cron expression or descriptive schedule string
  schedule: string;
  homepage?: string;
}

export interface NormalizedRecord {
  uid: string;
  sourceId: string;
  jurisdiction: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  address?: string;
  raw?: Record<string, unknown>;
}

export interface ConnectorRunContext {
  jobId: string;
  attempt: number;
  scheduledFor: Date;
}

export interface ConnectorResult {
  records: NormalizedRecord[];
  fetchedAt: Date;
  sourceRevision?: string;
  isFallback?: boolean;
}

export interface Connector {
  readonly metadata: ConnectorMetadata;
  collect(context: ConnectorRunContext): Promise<ConnectorResult>;
}
