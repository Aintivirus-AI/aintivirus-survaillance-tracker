import { Module, OnModuleInit } from '@nestjs/common';
import { ConnectorRegistry } from './connector.registry';
import { AtlasOfSurveillanceConnector } from './atlasofsurveillance.connector';
import { RedlightCameraListConnector } from './redlightcameralist.connector';
import { OverpassConnector } from './overpass.connector';
import { SourceModule } from '../sources/source.module';
import { SourceService } from '../sources/source.service';
import { GeocodingModule } from '../geocoding/geocoding.module';

@Module({
  imports: [SourceModule, GeocodingModule],
  providers: [
    ConnectorRegistry,
    AtlasOfSurveillanceConnector,
    RedlightCameraListConnector,
    OverpassConnector,
  ],
  exports: [ConnectorRegistry, SourceModule],
})
export class ConnectorsModule implements OnModuleInit {
  constructor(
    private readonly registry: ConnectorRegistry,
    private readonly sourceService: SourceService,
    private readonly atlas: AtlasOfSurveillanceConnector,
    private readonly redlight: RedlightCameraListConnector,
    private readonly overpass: OverpassConnector,
  ) {}

  async onModuleInit(): Promise<void> {
    const connectors = [this.redlight, this.atlas, this.overpass];
    connectors.forEach((connector) => this.registry.register(connector));
    await Promise.all(
      connectors.map((connector) =>
        this.sourceService.upsertFromMetadata(connector.metadata),
      ),
    );
  }
}
