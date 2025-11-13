import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SourceEntity } from './source.entity';
import { RecordEntity } from './record.entity';

@Entity({ name: 'snapshots' })
export class SnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_key' })
  sourceKey!: string;

  @ManyToOne(() => SourceEntity, (source) => source.snapshots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'source_key', referencedColumnName: 'key' })
  source!: SourceEntity;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @Column({ nullable: true })
  revision?: string;

  @Column({ type: 'int', default: 0 })
  recordCount!: number;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(() => RecordEntity, (record) => record.snapshot, {
    cascade: ['insert'],
  })
  records!: RecordEntity[];
}
