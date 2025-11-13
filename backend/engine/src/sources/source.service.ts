import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceEntity } from '../database/entities/source.entity';
import { ConnectorMetadata } from '../connectors/connector.types';

@Injectable()
export class SourceService {
  private readonly logger = new Logger(SourceService.name);

  constructor(
    @InjectRepository(SourceEntity)
    private readonly repository: Repository<SourceEntity>,
  ) {}

  async upsertFromMetadata(metadata: ConnectorMetadata): Promise<SourceEntity> {
    const existing = await this.repository.findOne({
      where: { key: metadata.id },
    });

    if (existing) {
      const updated = this.repository.merge(existing, {
        title: metadata.title,
        description: metadata.description,
        kind: metadata.kind,
        homepage: metadata.homepage,
        schedule: metadata.schedule,
        enabled: true,
      });
      return this.repository.save(updated);
    }

    const created = this.repository.create({
      key: metadata.id,
      title: metadata.title,
      description: metadata.description,
      kind: metadata.kind,
      homepage: metadata.homepage,
      schedule: metadata.schedule,
      enabled: true,
      totalRecords: 0,
    });
    this.logger.log(`Created new source record for ${metadata.id}`);
    return this.repository.save(created);
  }

  async markIngested(
    key: string,
    recordCount: number,
    revision?: string,
  ): Promise<void> {
    await this.repository.update(
      { key },
      {
        totalRecords: recordCount,
        lastRevision: revision,
        lastIngestedAt: new Date(),
      },
    );
  }

  async listSources(): Promise<SourceEntity[]> {
    return this.repository.find({
      order: { title: 'ASC' },
    });
  }
}
