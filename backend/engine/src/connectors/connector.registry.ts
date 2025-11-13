import { Injectable, Logger } from '@nestjs/common';
import { Connector } from './connector.types';

@Injectable()
export class ConnectorRegistry {
  private readonly logger = new Logger(ConnectorRegistry.name);
  private readonly connectors = new Map<string, Connector>();

  register(connector: Connector): void {
    const { id } = connector.metadata;
    if (this.connectors.has(id)) {
      throw new Error(`Connector with id "${id}" is already registered`);
    }

    this.logger.log(
      `Registering connector "${id}" (${connector.metadata.title})`,
    );
    this.connectors.set(id, connector);
  }

  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  list(): Connector[] {
    return Array.from(this.connectors.values());
  }
}
