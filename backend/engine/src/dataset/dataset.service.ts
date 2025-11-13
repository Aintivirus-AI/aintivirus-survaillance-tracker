import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceEntity } from '../database/entities/source.entity';
import { SnapshotEntity } from '../database/entities/snapshot.entity';
import { RecordEntity } from '../database/entities/record.entity';
import { DatasetRecord, DatasetSource, LatestDataset } from './dataset.types';

@Injectable()
export class DatasetService {
  constructor(
    @InjectRepository(SourceEntity)
    private readonly sourceRepository: Repository<SourceEntity>,
    @InjectRepository(SnapshotEntity)
    private readonly snapshotRepository: Repository<SnapshotEntity>,
    @InjectRepository(RecordEntity)
    private readonly recordRepository: Repository<RecordEntity>,
  ) {}

  async buildLatestDataset(): Promise<LatestDataset> {
    const sources = await this.sourceRepository.find({
      order: { title: 'ASC' },
    });

    const datasetSources: DatasetSource[] = [];

    for (const source of sources) {
      const snapshot = await this.snapshotRepository.findOne({
        where: { sourceKey: source.key },
        order: { createdAt: 'DESC' },
      });

      if (!snapshot) {
        continue;
      }

      const records = await this.recordRepository.find({
        where: { snapshotId: snapshot.id },
      });

      datasetSources.push({
        key: source.key,
        title: source.title,
        description: source.description ?? undefined,
        kind: source.kind,
        homepage: source.homepage ?? undefined,
        schedule: source.schedule ?? undefined,
        lastIngestedAt: source.lastIngestedAt
          ? source.lastIngestedAt.toISOString()
          : undefined,
        lastRevision: source.lastRevision ?? undefined,
        totalRecords: source.totalRecords,
        snapshot: {
          id: snapshot.id,
          createdAt: snapshot.createdAt.toISOString(),
          revision: snapshot.revision ?? undefined,
          recordCount: snapshot.recordCount,
        },
        records: records.map((record) => this.toDatasetRecord(record)),
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      sources: datasetSources,
    };
  }

  async buildSourceDataset(sourceKey: string): Promise<DatasetSource | null> {
    const source = await this.sourceRepository.findOne({
      where: { key: sourceKey },
    });
    if (!source) {
      return null;
    }

    const snapshot = await this.snapshotRepository.findOne({
      where: { sourceKey },
      order: { createdAt: 'DESC' },
    });
    if (!snapshot) {
      return null;
    }

    const records = await this.recordRepository.find({
      where: { snapshotId: snapshot.id },
    });

    return {
      key: source.key,
      title: source.title,
      description: source.description ?? undefined,
      kind: source.kind,
      homepage: source.homepage ?? undefined,
      schedule: source.schedule ?? undefined,
      lastIngestedAt: source.lastIngestedAt
        ? source.lastIngestedAt.toISOString()
        : undefined,
      lastRevision: source.lastRevision ?? undefined,
      totalRecords: source.totalRecords,
      snapshot: {
        id: snapshot.id,
        createdAt: snapshot.createdAt.toISOString(),
        revision: snapshot.revision ?? undefined,
        recordCount: snapshot.recordCount,
      },
      records: records.map((record) => this.toDatasetRecord(record)),
    };
  }

  private toDatasetRecord(record: RecordEntity): DatasetRecord {
    return {
      uid: record.uid,
      jurisdiction: record.jurisdiction ?? undefined,
      address: record.address ?? undefined,
      category: record.category ?? undefined,
      latitude: record.latitude ?? undefined,
      longitude: record.longitude ?? undefined,
      raw: record.raw ?? undefined,
    };
  }
}
