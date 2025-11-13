import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SnapshotEntity } from './snapshot.entity';

@Entity({ name: 'records' })
@Index(['snapshotId'])
@Index(['sourceKey'])
export class RecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'snapshot_id' })
  snapshotId!: string;

  @ManyToOne(() => SnapshotEntity, (snapshot) => snapshot.records, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'snapshot_id' })
  snapshot!: SnapshotEntity;

  @Column({ name: 'source_key' })
  sourceKey!: string;

  @Column()
  uid!: string;

  @Column({ nullable: true })
  jurisdiction?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ type: 'float', nullable: true })
  latitude?: number;

  @Column({ type: 'float', nullable: true })
  longitude?: number;

  @Column({ type: 'simple-json', nullable: true })
  raw?: Record<string, unknown>;
}
