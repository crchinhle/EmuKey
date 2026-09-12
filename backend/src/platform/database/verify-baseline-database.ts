import type { Client, QueryResultRow } from 'pg';

const EXPECTED_TABLES = [
  'audit_logs',
  'chain_commands',
  'chain_events',
  'chain_indexer_checkpoints',
  'conversations',
  'knowledge_chunks',
  'knowledge_documents',
  'license_devices',
  'licenses',
  'messages',
  'mobile_push_tokens',
  'notifications',
  'orders',
  'payment_attempts',
  'payment_transactions',
  'plans',
  'products',
  'users',
] as const;

const EXPECTED_EXTENSIONS = ['citext', 'pgcrypto', 'vector'] as const;

const EXPECTED_CRITICAL_CONSTRAINTS = {
  fk_conversations_customer:
    'FOREIGN KEY (customer_user_id, customer_role) REFERENCES users(id, role) ON DELETE RESTRICT',
  fk_chain_commands_issue_order_license:
    'FOREIGN KEY (license_id, provider_user_id, issue_order_id) REFERENCES licenses(id, provider_user_id, origin_order_id) ON DELETE RESTRICT',
  fk_chain_commands_order_provider:
    'FOREIGN KEY (order_id, provider_user_id) REFERENCES orders(id, provider_user_id) ON DELETE RESTRICT',
  fk_chain_commands_renewal_order_license:
    'FOREIGN KEY (renewal_order_id, provider_user_id, license_id, renewal_order_type) REFERENCES orders(id, provider_user_id, target_license_id, order_type) ON DELETE RESTRICT',
  fk_chain_events_command_device:
    'FOREIGN KEY (chain_command_id, license_id, license_device_id) REFERENCES chain_commands(id, license_id, license_device_id) ON DELETE RESTRICT',
  fk_chain_events_command_subject:
    'FOREIGN KEY (chain_command_id, provider_user_id, license_id) REFERENCES chain_commands(id, provider_user_id, license_id) ON DELETE RESTRICT',
  fk_license_devices_last_chain_event:
    'FOREIGN KEY (last_applied_chain_event_id, id, license_id) REFERENCES chain_events(id, license_device_id, license_id) ON DELETE RESTRICT',
  fk_licenses_last_chain_event:
    'FOREIGN KEY (last_applied_chain_event_id, id) REFERENCES chain_events(id, license_id) ON DELETE RESTRICT',
  fk_licenses_plan:
    'FOREIGN KEY (plan_id, product_id, provider_user_id, plan_commitment) REFERENCES plans(id, product_id, provider_user_id, plan_commitment) ON DELETE RESTRICT',
  fk_orders_plan:
    'FOREIGN KEY (plan_id, product_id, provider_user_id, plan_commitment_snapshot) REFERENCES plans(id, product_id, provider_user_id, plan_commitment) ON DELETE RESTRICT',
  fk_orders_target_license:
    'FOREIGN KEY (target_license_id, provider_user_id, customer_user_id) REFERENCES licenses(id, provider_user_id, customer_user_id) ON DELETE RESTRICT',
  fk_payment_transactions_attempt_order:
    'FOREIGN KEY (payment_attempt_id, order_id) REFERENCES payment_attempts(id, order_id) ON DELETE RESTRICT',
} as const;

const EXPECTED_CRITICAL_INDEXES = {
  chain_indexer_checkpoints_pkey:
    'CREATE UNIQUE INDEX chain_indexer_checkpoints_pkey ON public.chain_indexer_checkpoints USING btree (network, chain_id, contract_address)',
  ix_chain_commands_retry:
    "CREATE INDEX ix_chain_commands_retry ON public.chain_commands USING btree (status, next_attempt_at, created_at) WHERE ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'SUBMITTED_UNKNOWN'::character varying, 'RETRYABLE_FAILED'::character varying])::text[]))",
  ix_chain_events_finality:
    'CREATE INDEX ix_chain_events_finality ON public.chain_events USING btree (network, chain_id, contract_address, finality_status, block_number)',
  uq_chain_commands_tx_hash:
    'CREATE UNIQUE INDEX uq_chain_commands_tx_hash ON public.chain_commands USING btree (network, chain_id, transaction_hash) WHERE (transaction_hash IS NOT NULL)',
  uq_chain_commands_relayer_nonce:
    'CREATE UNIQUE INDEX uq_chain_commands_relayer_nonce ON public.chain_commands USING btree (network, chain_id, relayer_address, nonce) WHERE ((relayer_address IS NOT NULL) AND (nonce IS NOT NULL))',
  uq_knowledge_documents_one_current:
    'CREATE UNIQUE INDEX uq_knowledge_documents_one_current ON public.knowledge_documents USING btree (provider_user_id, logical_document_key) WHERE is_current',
  uq_users_provider_chain_address:
    'CREATE UNIQUE INDEX uq_users_provider_chain_address ON public.users USING btree (provider_chain_address) WHERE (provider_chain_address IS NOT NULL)',
  uq_users_provider_chain_namespace:
    'CREATE UNIQUE INDEX uq_users_provider_chain_namespace ON public.users USING btree (provider_chain_namespace) WHERE (provider_chain_namespace IS NOT NULL)',
} as const;

const EXPECTED_CRITICAL_COLUMNS = {
  'users.customer_type': {
    dataType: 'character varying',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'YES',
  },
  'orders.customer_user_id': {
    dataType: 'uuid',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'NO',
  },
  'licenses.customer_user_id': {
    dataType: 'uuid',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'NO',
  },
  'conversations.customer_user_id': {
    dataType: 'uuid',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'NO',
  },
  'chain_indexer_checkpoints.next_block': {
    dataType: 'bigint',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'NO',
  },
  'chain_commands.nonce': {
    dataType: 'bigint',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'YES',
  },
  'chain_commands.receipt_status': {
    dataType: 'character varying',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'YES',
  },
  'chain_commands.relayer_address': {
    dataType: 'character varying',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'YES',
  },
  'chain_commands.signed_transaction': {
    dataType: 'text',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'YES',
  },
  'chain_commands.issue_order_id': {
    dataType: 'uuid',
    expression:
      "CASE WHEN ((command_type)::text = 'ISSUE_LICENSE'::text) THEN order_id ELSE NULL::uuid END",
    isGenerated: 'ALWAYS',
    isNullable: 'YES',
  },
  'chain_commands.renewal_order_id': {
    dataType: 'uuid',
    expression:
      "CASE WHEN ((command_type)::text = 'RENEW_LICENSE'::text) THEN order_id ELSE NULL::uuid END",
    isGenerated: 'ALWAYS',
    isNullable: 'YES',
  },
  'chain_commands.renewal_order_type': {
    dataType: 'character varying',
    expression:
      "CASE WHEN ((command_type)::text = 'RENEW_LICENSE'::text) THEN 'RENEWAL'::text ELSE NULL::text END",
    isGenerated: 'ALWAYS',
    isNullable: 'YES',
  },
  'products.image_url': {
    dataType: 'text',
    expression: null,
    isGenerated: 'NEVER',
    isNullable: 'YES',
  },
} as const;

interface CountRow extends QueryResultRow {
  count: string;
}

interface NameRow extends QueryResultRow {
  name: string;
}

interface DefinitionRow extends NameRow {
  definition: string;
}

interface ColumnRow extends QueryResultRow {
  columnName: string;
  dataType: string;
  generationExpression: string | null;
  isGenerated: string;
  isNullable: string;
  tableName: string;
}

export interface BaselineDatabaseReport {
  constraints: number;
  extraTables: string[];
  foreignKeys: number;
  indexes: number;
  matchesBaseline: boolean;
  missingCriticalColumns: string[];
  missingCriticalConstraints: string[];
  mismatchedCriticalConstraints: string[];
  missingCriticalIndexes: string[];
  mismatchedCriticalIndexes: string[];
  mismatchedCriticalColumns: string[];
  missingExtensions: string[];
  missingTables: string[];
  tables: number;
}

async function count(database: Client, sql: string): Promise<number> {
  const result = await database.query<CountRow>(sql);
  return Number(result.rows[0]?.count ?? 0);
}

function normalizeDefinition(definition: string): string {
  return definition.replace(/\s+/g, ' ').trim().toLowerCase();
}

function compareDefinitions(
  rows: DefinitionRow[],
  expected: Readonly<Record<string, string>>,
): { missing: string[]; mismatched: string[] } {
  const actual = new Map(rows.map((row) => [row.name, row.definition]));
  const missing = Object.keys(expected).filter((name) => !actual.has(name));
  const mismatched = Object.entries(expected)
    .filter(([name, definition]) => {
      const actualDefinition = actual.get(name);
      return (
        actualDefinition !== undefined &&
        normalizeDefinition(actualDefinition) !==
          normalizeDefinition(definition)
      );
    })
    .map(([name]) => name);
  return { missing, mismatched };
}

export async function verifyBaselineDatabase(
  database: Client,
): Promise<BaselineDatabaseReport> {
  const tableResult = await database.query<NameRow>(
    `SELECT tablename AS name
     FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename`,
  );
  const actualTables = tableResult.rows.map(({ name }) => name);
  const missingTables = EXPECTED_TABLES.filter(
    (table) => !actualTables.includes(table),
  );
  const extraTables = actualTables.filter(
    (table) =>
      !EXPECTED_TABLES.includes(table as (typeof EXPECTED_TABLES)[number]),
  );

  const extensionResult = await database.query<NameRow>(
    `SELECT extname AS name
     FROM pg_extension
     WHERE extname = ANY($1::text[])
     ORDER BY extname`,
    [[...EXPECTED_EXTENSIONS]],
  );
  const actualExtensions = extensionResult.rows.map(({ name }) => name);
  const missingExtensions = EXPECTED_EXTENSIONS.filter(
    (extension) => !actualExtensions.includes(extension),
  );

  const constraintResult = await database.query<DefinitionRow>(
    `SELECT c.conname AS name, pg_get_constraintdef(c.oid, true) AS definition
     FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = 'public' AND c.conname = ANY($1::text[])
     ORDER BY c.conname`,
    [[...Object.keys(EXPECTED_CRITICAL_CONSTRAINTS)]],
  );
  const constraintDefinitions = compareDefinitions(
    constraintResult.rows,
    EXPECTED_CRITICAL_CONSTRAINTS,
  );

  const indexResult = await database.query<DefinitionRow>(
    `SELECT indexname AS name, indexdef AS definition
     FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = ANY($1::text[])
     ORDER BY indexname`,
    [[...Object.keys(EXPECTED_CRITICAL_INDEXES)]],
  );
  const indexDefinitions = compareDefinitions(
    indexResult.rows,
    EXPECTED_CRITICAL_INDEXES,
  );

  const columnResult = await database.query<ColumnRow>(
    `SELECT
       table_name AS "tableName",
       column_name AS "columnName",
       data_type AS "dataType",
       is_nullable AS "isNullable",
       is_generated AS "isGenerated",
       generation_expression AS "generationExpression"
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name || '.' || column_name = ANY($1::text[])
     ORDER BY table_name, column_name`,
    [Object.keys(EXPECTED_CRITICAL_COLUMNS)],
  );
  const actualColumns = new Map(
    columnResult.rows.map((column) => [
      `${column.tableName}.${column.columnName}`,
      column,
    ]),
  );
  const missingCriticalColumns = Object.keys(EXPECTED_CRITICAL_COLUMNS).filter(
    (name) => !actualColumns.has(name),
  );
  const mismatchedCriticalColumns = Object.entries(EXPECTED_CRITICAL_COLUMNS)
    .filter(([name, expected]) => {
      const actual = actualColumns.get(name);
      return (
        actual !== undefined &&
        (actual.dataType !== expected.dataType ||
          actual.isNullable !== expected.isNullable ||
          actual.isGenerated !== expected.isGenerated ||
          normalizeDefinition(actual.generationExpression ?? '') !==
            normalizeDefinition(expected.expression ?? ''))
      );
    })
    .map(([name]) => name);

  const foreignKeys = await count(
    database,
    `SELECT COUNT(*)::text AS count
     FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = 'public' AND c.contype = 'f'`,
  );
  const indexes = await count(
    database,
    `SELECT COUNT(*)::text AS count
     FROM pg_indexes
     WHERE schemaname = 'public'`,
  );
  const constraints = await count(
    database,
    `SELECT COUNT(*)::text AS count
     FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = 'public' AND c.contype IN ('c', 'f', 'p', 'u')`,
  );

  return {
    constraints,
    extraTables,
    foreignKeys,
    indexes,
    matchesBaseline:
      missingTables.length === 0 &&
      extraTables.length === 0 &&
      missingExtensions.length === 0 &&
      missingCriticalColumns.length === 0 &&
      mismatchedCriticalColumns.length === 0 &&
      constraintDefinitions.missing.length === 0 &&
      constraintDefinitions.mismatched.length === 0 &&
      indexDefinitions.missing.length === 0 &&
      indexDefinitions.mismatched.length === 0 &&
      true,
    missingCriticalColumns,
    missingCriticalConstraints: constraintDefinitions.missing,
    mismatchedCriticalConstraints: constraintDefinitions.mismatched,
    missingCriticalIndexes: indexDefinitions.missing,
    mismatchedCriticalIndexes: indexDefinitions.mismatched,
    mismatchedCriticalColumns,
    missingExtensions: [...missingExtensions],
    missingTables: [...missingTables],
    tables: actualTables.length,
  };
}
