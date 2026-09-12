import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from '../../app.module.js';
import { ApiExceptionFilter } from '../../platform/http/api-exception.filter.js';
import { configureOpenApi } from '../../platform/http/openapi.js';

export interface CreateApiApplicationOptions {
  logger?: false;
}

export async function createApiApplication(
  options: CreateApiApplicationOptions = {},
): Promise<INestApplication> {
  const loggingOptions =
    options.logger === false
      ? ({ logger: false } as const)
      : ({ bufferLogs: true } as const);
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    ...loggingOptions,
    routeConflictPolicy: { duplicate: 'error', shadow: 'warn' },
    routeResolutionStrategy: 'specificity',
  });
  if (options.logger !== false) {
    app.useLogger(app.get(Logger));
  }

  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    credentials: true,
    origin: config.getOrThrow<string[]>('CORS_ORIGINS'),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  configureOpenApi(app);

  app.enableShutdownHooks();
  return app;
}
