import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import configuration from './configuration/configuration';
import { DatabaseModule } from './database/database.module';
import { QueuesModule } from './queues/queues.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { DatasetModule } from './dataset/dataset.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('redis.url');
        const host = configService.get<string>('redis.host');
        const port = configService.get<number>('redis.port');

        return {
          connection: url ? { url } : { host, port },
        };
      },
    }),
    DatabaseModule,
    QueuesModule,
    ConnectorsModule,
    DatasetModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
