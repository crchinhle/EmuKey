import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { ApiErrorEnvelopeDto } from './api-error.dto.js';

const OPENAPI_CONFIG = new DocumentBuilder()
  .setTitle('EmuKey API')
  .setDescription('Versioned API for the EmuKey license platform')
  .setVersion('1.0.0')
  .addBearerAuth()
  .build();

export function createOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(app, OPENAPI_CONFIG, {
    extraModels: [ApiErrorEnvelopeDto],
  });
}

export function configureOpenApi(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: 'api/v1/openapi.json',
  });
}
