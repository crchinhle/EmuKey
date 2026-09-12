import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';

import { AuditWriter } from '../../../src/platform/audit/audit-writer.js';
import { verifyBaselineDatabase } from '../../../src/platform/database/verify-baseline-database.js';

describe('account-linked buyer PostgreSQL baseline', () => {
  let container: StartedPostgreSqlContainer;
  let database: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg15')
      .withDatabase('emukey_schema_test')
      .withUsername('emukey')
      .withPassword('test-password')
      .start();
    database = new Client({ connectionString: container.getConnectionUri() });
    await database.connect();
    await database.query(await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
  }, 120_000);

  afterAll(async () => {
    if (database) await database.end();
    if (container) await container.stop();
  });

  it('initializes the exact 18-table account-linked schema', async () => {
    const report = await verifyBaselineDatabase(database);
    expect(report).toMatchObject({
      extraTables: [],
      matchesBaseline: true,
      missingExtensions: [],
      missingTables: [],
      tables: 18,
    });
  });

  it('owns orders and licenses through customer accounts without controller keys', async () => {
    const result = await database.query<{ name: string }>(
      `SELECT table_name || '.' || column_name AS name
       FROM information_schema.columns
       WHERE table_schema='public'
         AND column_name='customer_user_id'
         AND table_name IN ('orders','licenses','conversations')
       ORDER BY name`,
    );
    expect(result.rows.map(({ name }) => name)).toEqual([
      'conversations.customer_user_id',
      'licenses.customer_user_id',
      'orders.customer_user_id',
    ]);
    const controllerTables = await database.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customer_controllers'",
    );
    expect(controllerTables.rows).toEqual([]);
  });

  it('does not retain the removed order access-token column', async () => {
    const result = await database.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='access_token_hash'",
    );
    expect(result.rows).toEqual([]);
  });

  it('rolls audit evidence back with its business transaction', async () => {
    const audit = new AuditWriter();
    await database.query('BEGIN');
    await audit.write(database, {
      action: 'ROLLBACK_TEST',
      actorRole: 'CUSTOMER',
      targetType: 'ORDER',
    });
    await database.query('ROLLBACK');
    const result = await database.query(
      "SELECT id FROM audit_logs WHERE action='ROLLBACK_TEST'",
    );
    expect(result.rows).toEqual([]);
  });
});
