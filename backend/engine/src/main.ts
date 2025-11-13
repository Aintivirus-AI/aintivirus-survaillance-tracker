import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('cors.origins') ?? [
    'http://localhost:5173',
  ];

  app.enableCors({
    origin: corsOrigins,
    credentials: false,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`Engine HTTP server listening on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  if (error instanceof Error) {
    logger.error(`Engine bootstrap failed: ${error.message}`, error.stack);
  } else {
    logger.error(`Engine bootstrap failed: ${JSON.stringify(error)}`);
  }
  process.exit(1);
});
