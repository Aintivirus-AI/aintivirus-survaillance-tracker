import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { dirname } from 'path';
import { promises as fs } from 'fs';
import { SourceEntity } from './entities/source.entity';
import { SnapshotEntity } from './entities/snapshot.entity';
import { RecordEntity } from './entities/record.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databasePath = configService.get<string>('database.path');
        if (!databasePath) {
          throw new Error('Database path is not configured');
        }

        return {
          type: 'sqlite' as const,
          database: databasePath,
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
    TypeOrmModule.forFeature([SourceEntity, SnapshotEntity, RecordEntity]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const databasePath = this.configService.get<string>('database.path');
    if (databasePath) {
      await fs.mkdir(dirname(databasePath), { recursive: true });
    }
  }
}
