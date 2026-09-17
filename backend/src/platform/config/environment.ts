const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
] as const;
const EMAIL_ADAPTERS = ['fake', 'brevo'] as const;
const PAYMENT_ADAPTERS = ['fake', 'sepay'] as const;
const SEPAY_ENVIRONMENTS = ['sandbox', 'production'] as const;
const LOCAL_ADAPTERS = [
  'PAYMENT_ADAPTER',
  'AI_ADAPTER',
  'EMAIL_ADAPTER',
  'PUSH_ADAPTER',
] as const;
const HARDHAT_DEVELOPMENT_RELAYER_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
type LogLevel = (typeof LOG_LEVELS)[number];
type EmailAdapter = (typeof EMAIL_ADAPTERS)[number];
type PaymentAdapter = (typeof PAYMENT_ADAPTERS)[number];
type SePayEnvironment = (typeof SEPAY_ENVIRONMENTS)[number];

export interface PlatformEnvironment {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  CORS_ORIGINS: string[];
  LOG_LEVEL: LogLevel;
  OTEL_ENABLED: boolean;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  PAYMENT_ADAPTER: PaymentAdapter;
  IPN_DELIVERY_GRACE_SECONDS: number;
  PAYMENT_WEBHOOK_SECRET?: string;
  SEPAY_ENV?: SePayEnvironment;
  SEPAY_MERCHANT_ID?: string;
  SEPAY_SECRET_KEY?: string;
  AI_ADAPTER: string;
  EMAIL_ADAPTER: EmailAdapter;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  WEB_APP_URL?: string;
  PUSH_ADAPTER: string;
  EVM_ADAPTER: string;
  EVM_NETWORK: string;
  EVM_CHAIN_ID: number;
  EVM_CONFIRMATIONS: number;
  EVM_CONTRACT_ADDRESS: string;
  EVM_DEPLOYMENT_BLOCK?: number;
  EVM_INDEXER_BATCH_SIZE?: number;
  EVM_RPC_HTTP_URL?: string;
  EVM_RPC_FALLBACK_HTTP_URL?: string;
  EVM_RELAYER_PRIVATE_KEY?: string;
  STORAGE_ADAPTER: string;
  ACTIVATION_ENVELOPE_ADAPTER: string;
  ACTIVATION_ENVELOPE_KEY: string;
  TERMS_VERSION: number;
  TERMS_APPROVED_HASH?: string;
  JWT_SECRET: string;
}

function requiredString(
  environment: Record<string, unknown>,
  name: string,
): string {
  const value = environment[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function oneOf<const T extends readonly string[]>(
  value: string,
  name: string,
  options: T,
): T[number] {
  if (!options.includes(value)) {
    throw new Error(`${name} must be one of: ${options.join(', ')}`);
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return parsed;
}

function parseBoolean(value: string, name: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function parseOrigins(value: string): string[] {
  const origins = [...new Set(value.split(',').map((origin) => origin.trim()))];
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
  }
  return origins;
}

function assertHttpUrl(value: string, name: string): void {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): PlatformEnvironment {
  const nodeEnvironment = oneOf(
    requiredString(environment, 'NODE_ENV'),
    'NODE_ENV',
    NODE_ENVIRONMENTS,
  );
  const otelEnabled = parseBoolean(
    requiredString(environment, 'OTEL_ENABLED'),
    'OTEL_ENABLED',
  );
  const otlpEndpoint =
    typeof environment.OTEL_EXPORTER_OTLP_ENDPOINT === 'string' &&
    environment.OTEL_EXPORTER_OTLP_ENDPOINT.trim() !== ''
      ? environment.OTEL_EXPORTER_OTLP_ENDPOINT.trim()
      : undefined;

  if (otelEnabled && otlpEndpoint === undefined) {
    throw new Error('OTEL_EXPORTER_OTLP_ENDPOINT is required');
  }
  if (otlpEndpoint !== undefined) {
    assertHttpUrl(otlpEndpoint, 'OTEL_EXPORTER_OTLP_ENDPOINT');
  }

  const result: PlatformEnvironment = {
    NODE_ENV: nodeEnvironment,
    PORT: parsePort(requiredString(environment, 'PORT')),
    DATABASE_URL: requiredString(environment, 'DATABASE_URL'),
    REDIS_URL: requiredString(environment, 'REDIS_URL'),
    CORS_ORIGINS: parseOrigins(requiredString(environment, 'CORS_ORIGINS')),
    LOG_LEVEL: oneOf(
      requiredString(environment, 'LOG_LEVEL'),
      'LOG_LEVEL',
      LOG_LEVELS,
    ),
    OTEL_ENABLED: otelEnabled,
    PAYMENT_ADAPTER: oneOf(
      requiredString(environment, 'PAYMENT_ADAPTER'),
      'PAYMENT_ADAPTER',
      PAYMENT_ADAPTERS,
    ),
    IPN_DELIVERY_GRACE_SECONDS: parsePositiveInteger(
      typeof environment.IPN_DELIVERY_GRACE_SECONDS === 'string' &&
        environment.IPN_DELIVERY_GRACE_SECONDS.trim() !== ''
        ? environment.IPN_DELIVERY_GRACE_SECONDS
        : '86400',
      'IPN_DELIVERY_GRACE_SECONDS',
    ),
    AI_ADAPTER: requiredString(environment, 'AI_ADAPTER'),
    EMAIL_ADAPTER: oneOf(
      requiredString(environment, 'EMAIL_ADAPTER'),
      'EMAIL_ADAPTER',
      EMAIL_ADAPTERS,
    ),
    PUSH_ADAPTER: requiredString(environment, 'PUSH_ADAPTER'),
    EVM_ADAPTER: requiredString(environment, 'EVM_ADAPTER'),
    EVM_NETWORK: requiredString(environment, 'EVM_NETWORK'),
    EVM_CHAIN_ID: parsePositiveInteger(
      requiredString(environment, 'EVM_CHAIN_ID'),
      'EVM_CHAIN_ID',
    ),
    EVM_CONFIRMATIONS: parsePositiveInteger(
      requiredString(environment, 'EVM_CONFIRMATIONS'),
      'EVM_CONFIRMATIONS',
    ),
    EVM_CONTRACT_ADDRESS: requiredString(environment, 'EVM_CONTRACT_ADDRESS'),
    STORAGE_ADAPTER: requiredString(environment, 'STORAGE_ADAPTER'),
    ACTIVATION_ENVELOPE_ADAPTER: requiredString(
      environment,
      'ACTIVATION_ENVELOPE_ADAPTER',
    ),
    ACTIVATION_ENVELOPE_KEY: requiredString(
      environment,
      'ACTIVATION_ENVELOPE_KEY',
    ),
    TERMS_VERSION: parsePositiveInteger(
      requiredString(environment, 'TERMS_VERSION'),
      'TERMS_VERSION',
    ),
    JWT_SECRET: requiredString(environment, 'JWT_SECRET'),
  };

  if (otlpEndpoint !== undefined) {
    result.OTEL_EXPORTER_OTLP_ENDPOINT = otlpEndpoint;
  }
  if (result.EMAIL_ADAPTER === 'brevo') {
    result.BREVO_API_KEY = requiredString(environment, 'BREVO_API_KEY');
    result.BREVO_SENDER_EMAIL = requiredString(
      environment,
      'BREVO_SENDER_EMAIL',
    );
    result.BREVO_SENDER_NAME = requiredString(
      environment,
      'BREVO_SENDER_NAME',
    );
  }
  if (result.PAYMENT_ADAPTER === 'sepay') {
    result.SEPAY_ENV = oneOf(
      requiredString(environment, 'SEPAY_ENV'),
      'SEPAY_ENV',
      SEPAY_ENVIRONMENTS,
    );
    result.SEPAY_MERCHANT_ID = requiredString(environment, 'SEPAY_MERCHANT_ID');
    result.SEPAY_SECRET_KEY = requiredString(environment, 'SEPAY_SECRET_KEY');
  } else {
    result.PAYMENT_WEBHOOK_SECRET = requiredString(
      environment,
      'PAYMENT_WEBHOOK_SECRET',
    );
  }
  if (result.EMAIL_ADAPTER === 'brevo' || result.PAYMENT_ADAPTER === 'sepay') {
    result.WEB_APP_URL = requiredString(environment, 'WEB_APP_URL');
    assertHttpUrl(result.WEB_APP_URL, 'WEB_APP_URL');
  }
  if (result.EVM_ADAPTER !== 'viem') {
    throw new Error('EVM_ADAPTER must use viem');
  }
  result.EVM_RPC_HTTP_URL = requiredString(environment, 'EVM_RPC_HTTP_URL');
  assertHttpUrl(result.EVM_RPC_HTTP_URL, 'EVM_RPC_HTTP_URL');
  if (
    typeof environment.EVM_RPC_FALLBACK_HTTP_URL === 'string' &&
    environment.EVM_RPC_FALLBACK_HTTP_URL.trim() !== ''
  ) {
    result.EVM_RPC_FALLBACK_HTTP_URL = environment.EVM_RPC_FALLBACK_HTTP_URL.trim();
    assertHttpUrl(result.EVM_RPC_FALLBACK_HTTP_URL, 'EVM_RPC_FALLBACK_HTTP_URL');
  }
  result.EVM_DEPLOYMENT_BLOCK = parseNonNegativeInteger(
    requiredString(environment, 'EVM_DEPLOYMENT_BLOCK'),
    'EVM_DEPLOYMENT_BLOCK',
  );
  result.EVM_INDEXER_BATCH_SIZE = parsePositiveInteger(
    requiredString(environment, 'EVM_INDEXER_BATCH_SIZE'),
    'EVM_INDEXER_BATCH_SIZE',
  );
  result.EVM_RELAYER_PRIVATE_KEY = requiredString(
    environment,
    'EVM_RELAYER_PRIVATE_KEY',
  );
  if (!/^0x[0-9a-fA-F]{64}$/.test(result.EVM_RELAYER_PRIVATE_KEY)) {
    throw new Error('EVM_RELAYER_PRIVATE_KEY must contain a 32-byte hex key');
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(result.EVM_CONTRACT_ADDRESS)) {
    throw new Error('EVM_CONTRACT_ADDRESS must contain a 20-byte address');
  }
  result.EVM_CONTRACT_ADDRESS = result.EVM_CONTRACT_ADDRESS.toLowerCase();
  if (!/^[0-9a-fA-F]{64}$/.test(result.ACTIVATION_ENVELOPE_KEY)) {
    throw new Error('ACTIVATION_ENVELOPE_KEY must contain exactly 32 bytes');
  }
  if (
    typeof environment.TERMS_APPROVED_HASH === 'string' &&
    environment.TERMS_APPROVED_HASH.trim() !== ''
  ) {
    const approvedHash = environment.TERMS_APPROVED_HASH.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(approvedHash)) {
      throw new Error('TERMS_APPROVED_HASH must contain 32 bytes');
    }
    result.TERMS_APPROVED_HASH = approvedHash;
  }

  if (nodeEnvironment === 'production') {
    for (const adapterName of LOCAL_ADAPTERS) {
      if (result[adapterName] === 'fake') {
        throw new Error(`${adapterName} cannot use fake in production`);
      }
    }
    if (
      result.EVM_RELAYER_PRIVATE_KEY?.toLowerCase() ===
      HARDHAT_DEVELOPMENT_RELAYER_KEY
    ) {
      throw new Error(
        'EVM_RELAYER_PRIVATE_KEY cannot use the public Hardhat development key in production',
      );
    }
    if (result.STORAGE_ADAPTER === 'local') {
      throw new Error('STORAGE_ADAPTER cannot use local in production');
    }
    if (!result.TERMS_APPROVED_HASH) {
      throw new Error('TERMS_APPROVED_HASH is required in production');
    }
  }

  return result;
}
