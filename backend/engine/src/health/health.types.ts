export type ComponentStatus = 'ok' | 'degraded' | 'error';

export interface ComponentReport<
  TMeta extends Record<string, unknown> | undefined = Record<string, unknown>,
> {
  status: ComponentStatus;
  latencyMs?: number;
  error?: string;
  meta?: TMeta;
}

export interface IngestionSummary extends Record<string, unknown> {
  lastIngestedAt?: string | null;
  sourcesTracked: number;
  totalRecords: number;
}

export interface HealthReport {
  status: ComponentStatus;
  timestamp: string;
  components: {
    database: ComponentReport;
    redis: ComponentReport;
    queue: ComponentReport<Record<string, unknown>>;
    ingestion: ComponentReport<IngestionSummary>;
  };
}
