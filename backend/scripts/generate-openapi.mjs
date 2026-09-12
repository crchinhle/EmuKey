import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const temporaryDirectory = check
  ? await mkdtemp(join(tmpdir(), 'emukey-backend-openapi-'))
  : undefined;
const specification = temporaryDirectory
  ? join(temporaryDirectory, 'openapi.json')
  : join(root, 'docs', 'openapi', 'openapi.json');

const environment = {
  ...process.env,
  AI_ADAPTER: 'fake',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://emukey:local@127.0.0.1:5432/emukey',
  EMAIL_ADAPTER: 'fake',
  EVM_ADAPTER: 'viem',
  EVM_NETWORK: 'hardhat',
  EVM_CHAIN_ID: '31337',
  EVM_CONFIRMATIONS: '2',
  EVM_CONTRACT_ADDRESS: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  EVM_DEPLOYMENT_BLOCK: '1',
  EVM_INDEXER_BATCH_SIZE: '500',
  EVM_RELAYER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
  EVM_RPC_HTTP_URL: 'http://127.0.0.1:8545',
  STORAGE_ADAPTER: 'local',
  ACTIVATION_ENVELOPE_ADAPTER: 'redis',
  ACTIVATION_ENVELOPE_KEY: '00'.repeat(32),
  TERMS_VERSION: '1',
  JWT_SECRET: 'openapi-generation-secret-at-least-32-bytes',
  LOG_LEVEL: 'fatal',
  NODE_ENV: 'test',
  OTEL_ENABLED: 'false',
  PAYMENT_ADAPTER: 'fake',
  PAYMENT_WEBHOOK_SECRET: 'openapi-payment-secret',
  PORT: '3100',
  PUSH_ADAPTER: 'fake',
  REDIS_URL: 'redis://127.0.0.1:6379',
};

const tscExecutable = join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: environment,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
}

try {
  run(tscExecutable, ['-p', 'tsconfig.build.json']);
  run('node', [
    join(root, 'dist', 'entrypoints', 'api', 'export-openapi.js'),
    specification,
  ]);

  if (check) {
    const expected = await readFile(
      join(root, 'docs', 'openapi', 'openapi.json'),
      'utf8',
    );
    const actual = await readFile(specification, 'utf8');
    if (actual !== expected) {
      throw new Error(
        'Backend OpenAPI document is out of date; run the OpenAPI generate script',
      );
    }
  }
} finally {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}
