import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { createPublicClient, defineChain, http, type Address } from 'viem';

import { ActivationEnvelopeRecoveryService } from '../../../src/modules/blockchain/application/activation-envelope-recovery.service.js';
import { ChainCommandService } from '../../../src/modules/blockchain/application/chain-command.service.js';
import { ChainIndexerService } from '../../../src/modules/blockchain/application/chain-indexer.service.js';
import { LicenseQueryService } from '../../../src/modules/blockchain/application/license-query.service.js';
import { RpcChainIndexerService } from '../../../src/modules/blockchain/application/rpc-chain-indexer.service.js';
import { ChainCommandRepository } from '../../../src/modules/blockchain/infrastructure/chain-command.repository.js';
import { ChainEventRepository } from '../../../src/modules/blockchain/infrastructure/chain-event.repository.js';
import { ChainIndexerCheckpointRepository } from '../../../src/modules/blockchain/infrastructure/chain-indexer-checkpoint.repository.js';
import { LicenseProjectionRepository } from '../../../src/modules/blockchain/infrastructure/license-projection.repository.js';
import { LocalPrivateKeyChainSigner } from '../../../src/modules/blockchain/infrastructure/local-private-key-chain-signer.js';
import { RedisActivationEnvelope } from '../../../src/modules/blockchain/infrastructure/redis-activation-envelope.js';
import { ViemChainEventSource } from '../../../src/modules/blockchain/infrastructure/viem-chain-event-source.js';
import { ViemChainRelayer } from '../../../src/modules/blockchain/infrastructure/viem-chain-relayer.js';
import { CommerceService } from '../../../src/modules/commerce-payment/application/commerce.service.js';
import { CommerceRepository } from '../../../src/modules/commerce-payment/infrastructure/commerce.repository.js';
import { FakePaymentGateway } from '../../../src/modules/commerce-payment/infrastructure/fake-payment.gateway.js';
import { seedBaseline } from '../../../src/platform/database/seed-baseline.js';

const rpcUrl = process.env.LOCAL_EVM_RPC_URL;
const contractAddress = process.env.LOCAL_EVM_CONTRACT_ADDRESS as
  Address | undefined;
const relayerPrivateKey = process.env.LOCAL_EVM_RELAYER_PRIVATE_KEY;
const describeRealRpc =
  rpcUrl && contractAddress && relayerPrivateKey ? describe : describe.skip;

describeRealRpc('customer durable chain golden flow over real JSON-RPC', () => {
  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let pool: Pool;
  let redis: Redis;
  let commerce: CommerceService;
  let envelopes: RedisActivationEnvelope;
  let publicClient: ReturnType<typeof createPublicClient>;
  const customer = {
    role: 'CUSTOMER' as const,
    sessionVersion: 1,
    sub: '00000000-0000-4000-8000-000000000004',
  };
  const otherCustomer = {
    ...customer,
    sub: '00000000-0000-4000-8000-000000000099',
  };
  const planId = '00000000-0000-4000-8000-000000000301';
  const webhookSecret = 'phase5-payment-secret';

  beforeAll(async () => {
    const chain = defineChain({
      id: 31_337,
      name: 'hardhat',
      nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
      rpcUrls: { default: { http: [rpcUrl!] } },
      testnet: true,
    });
    publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    [postgres, redisContainer] = await Promise.all([
      new PostgreSqlContainer('pgvector/pgvector:pg15')
        .withDatabase('emukey_phase5_test')
        .withUsername('emukey')
        .withPassword('test-password')
        .start(),
      new RedisContainer('redis:8.2-alpine').start(),
    ]);
    pool = new Pool({ connectionString: postgres.getConnectionUri() });
    await pool.query(
      await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'),
    );
    await seedBaseline(pool, 'Phase-five-test@123');
    redis = new Redis(redisContainer.getConnectionUrl());
    envelopes = new RedisActivationEnvelope(redis, '11'.repeat(32));
    await expect(
      publicClient.getCode({ address: contractAddress! }),
    ).resolves.toMatch(/^0x[0-9a-f]+$/);
    commerce = new CommerceService(
      new CommerceRepository(pool),
      new FakePaymentGateway(webhookSecret),
      envelopes,
      new ActivationEnvelopeRecoveryService(
        new ChainCommandRepository(pool),
        envelopes,
      ),
      {
        chainId: 31_337,
        contractAddress: contractAddress!,
        network: 'hardhat',
      },
    );
  }, 120_000);

  afterAll(async () => {
    if (redis) await redis.quit();
    if (pool) await pool.end();
    await Promise.all([postgres?.stop(), redisContainer?.stop()]);
  });

  it('gates the one-time activation secret by customer ownership and chain finality', async () => {
    const deploymentBlock = Number(await publicClient.getBlockNumber()) + 1;
    const order = await commerce.createOrder(
      customer,
      '00000000-0000-4000-8000-000000000703',
      undefined,
      { planId },
    );
    await commerce.acceptTerms(customer, order.id, {
      termsHash: order.termsHashSnapshot,
      termsVersion: order.termsVersionSnapshot,
    });
    const checkout = await commerce.checkout(customer, order.id);
    const payment = await commerce.ingestIpn(
      {
        amountVnd: order.priceVndSnapshot,
        eventId: 'phase5-customer-event-1',
        occurredAt: new Date().toISOString(),
        providerReference: checkout.checkoutReference,
      },
      webhookSecret,
    );
    const commandId = payment.commandId!;
    const licenseId = payment.licenseId!;

    const commandRepository = new ChainCommandRepository(pool);
    const relayer = new ViemChainRelayer({
      chainId: 31_337,
      network: 'hardhat',
      rpcUrl: rpcUrl!,
      signer: new LocalPrivateKeyChainSigner(relayerPrivateKey!),
    });
    const commands = new ChainCommandService(
      commandRepository,
      relayer,
      envelopes,
      new ActivationEnvelopeRecoveryService(commandRepository, envelopes),
    );
    expect(await commands.processNext('anonymous-worker')).toBe(commandId);

    const queries = new LicenseQueryService(
      new LicenseProjectionRepository(pool),
      envelopes,
      redis,
    );
    await expect(
      queries.retrieveActivation(customer, licenseId),
    ).rejects.toMatchObject({ status: 404 });

    await commands.reconcileReceipt('receipt-worker');
    await fetch(rpcUrl!, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [],
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const eventRepository = new ChainEventRepository(pool);
    const indexer = new ChainIndexerService(eventRepository, 2);
    const rpcIndexer = new RpcChainIndexerService(
      new ChainIndexerCheckpointRepository(pool),
      indexer,
      new ViemChainEventSource({
        chainId: 31_337,
        contractAddress: contractAddress!,
        network: 'hardhat',
        rpcUrl: rpcUrl!,
      }),
      {
        batchSize: 100,
        chainId: 31_337,
        contractAddress: contractAddress!,
        deploymentBlock,
        network: 'hardhat',
        requiredConfirmations: 2,
      },
    );
    await expect(rpcIndexer.poll('rpc-indexer')).resolves.toBe(1);
    const event = await pool.query<{
      chain_command_id: string;
      finality_status: string;
    }>(
      `SELECT chain_command_id, finality_status FROM chain_events
        WHERE chain_command_id=$1`,
      [commandId],
    );
    expect(event.rows[0]).toEqual({
      chain_command_id: commandId,
      finality_status: 'CONFIRMED',
    });
    const retrieved = await queries.retrieveActivation(customer, licenseId);
    expect(retrieved.activationKey).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(
      queries.retrieveActivation(customer, licenseId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(queries.find(otherCustomer, licenseId)).rejects.toMatchObject({
      status: 404,
    });
    const projection = await queries.find(customer, licenseId);
    expect(projection).toMatchObject({ id: licenseId, status: 'ACTIVE' });

    await pool.query(
      `UPDATE licenses SET status='SUSPENDED', suspended_at=now(),
         last_applied_chain_event_id=NULL WHERE id=$1`,
      [licenseId],
    );
    await pool.query(
      `UPDATE chain_commands SET status='SUBMITTED_UNKNOWN', confirmed_at=NULL
       WHERE id=$1`,
      [commandId],
    );
    const repair = await eventRepository.reconcileCanonicalProjections();
    expect(repair).toMatchObject({
      commandRepairs: 1,
      licenseIds: [licenseId],
      licenseRepairs: 1,
      remainingMismatches: 0,
    });
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({
      id: licenseId,
      status: 'ACTIVE',
    });
  });
});
