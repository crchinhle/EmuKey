import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabasePool extends Pool implements OnApplicationShutdown {
  constructor(config: ConfigService) {
    super({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      connectionTimeoutMillis: 2_000,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.end();
  }
}
