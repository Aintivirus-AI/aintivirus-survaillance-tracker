import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SnapshotEntity } from '../database/entities/snapshot.entity';
import { RecordEntity } from '../database/entities/record.entity';
import { Connector, ConnectorResult } from '../connectors/connector.types';
import { SourceService } from '../sources/source.service';

@Injectable()
export class IngestPersistenceService {
  private readonly logger = new Logger(IngestPersistenceService.name);

  constructor(
    private readonly sourceService: SourceService,
    @InjectRepository(SnapshotEntity)
    private readonly snapshotRepository: Repository<SnapshotEntity>,
    @InjectRepository(RecordEntity)
    private readonly recordRepository: Repository<RecordEntity>,
  ) {}

  async persist(
    connector: Connector,
    result: ConnectorResult,
  ): Promise<SnapshotEntity> {
    const source = await this.sourceService.upsertFromMetadata(
      connector.metadata,
    );

    if (result.isFallback) {
      const latestSnapshot = await this.snapshotRepository.findOne({
        where: { sourceKey: source.key },
        order: { createdAt: 'DESC' },
      });

      if (latestSnapshot) {
        this.logger.warn(
          `Skipping persistence for ${connector.metadata.id} fallback result; retaining snapshot ${latestSnapshot.id} with ${latestSnapshot.recordCount} records.`,
        );
        await this.sourceService.markIngested(
          source.key,
          latestSnapshot.recordCount,
          latestSnapshot.revision,
        );
        return latestSnapshot;
      }
    }

    const snapshot = this.snapshotRepository.create({
      sourceKey: source.key,
      revision: result.sourceRevision,
      recordCount: result.records.length,
      metadata: {
        fetchedAt: result.fetchedAt.toISOString(),
      },
    });

    const savedSnapshot = await this.snapshotRepository.save(snapshot);

    if (result.records.length > 0) {
      const recordEntities = result.records.map((record) =>
        this.recordRepository.create({
          snapshotId: savedSnapshot.id,
          sourceKey: source.key,
          uid: record.uid,
          jurisdiction: record.jurisdiction,
          address: record.address,
          category: record.category,
          latitude: record.latitude,
          longitude: record.longitude,
          raw: record.raw,
        }),
      );
      await this.recordRepository.save(recordEntities);
      savedSnapshot.recordCount = recordEntities.length;
      await this.snapshotRepository.save(savedSnapshot);
      await this.sourceService.markIngested(
        source.key,
        recordEntities.length,
        result.sourceRevision,
      );
    } else {
      await this.sourceService.markIngested(
        source.key,
        0,
        result.sourceRevision,
      );
    }

    return savedSnapshot;
  }
}
