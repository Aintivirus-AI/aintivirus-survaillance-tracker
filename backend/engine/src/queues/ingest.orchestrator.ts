import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConnectorRegistry } from '../connectors/connector.registry';
import { IngestProducer } from './ingest.producer';

@Injectable()
export class IngestOrchestrator implements OnApplicationBootstrap {
  private readonly logger = new Logger(IngestOrchestrator.name);

  constructor(
    private readonly connectorRegistry: ConnectorRegistry,
    private readonly producer: IngestProducer,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureSchedules();
  }

  async ensureSchedules(): Promise<void> {
    const connectors = this.connectorRegistry.list();
    if (connectors.length === 0) {
      this.logger.warn('No connectors registered; nothing to schedule.');
      return;
    }

    const activeIds = new Set(connectors.map((connector) => connector.metadata.id));
    await this.producer.pruneStaleRecurring(activeIds);

    for (const connector of connectors) {
      await this.producer.ensureRecurring(connector.metadata);
    }
  }
}
