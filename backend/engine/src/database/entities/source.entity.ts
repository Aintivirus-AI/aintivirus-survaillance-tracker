import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SnapshotEntity } from './snapshot.entity';

@Entity({ name: 'sources' })
export class SourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  key!: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ default: 'scrape' })
  kind!: string;

  @Column({ nullable: true })
  homepage?: string;

  @Column({ nullable: true })
  schedule?: string;

  @Column({ nullable: true })
  lastRevision?: string;

  @Column({ type: 'datetime', nullable: true })
  lastIngestedAt?: Date;

  @Column({ type: 'int', default: 0 })
  totalRecords!: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;

  @OneToMany(() => SnapshotEntity, (snapshot) => snapshot.source, {
    cascade: false,
  })
  snapshots?: SnapshotEntity[];
}
