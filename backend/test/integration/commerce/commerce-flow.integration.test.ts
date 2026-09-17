import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NotFoundException } from '@nestjs/common';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { Pool } from 'pg';

import { ActivationEnvelopeRecoveryService } from '../../../src/modules/blockchain/application/activation-envelope-recovery.service.js';
import { ChainCommandRepository } from '../../../src/modules/blockchain/infrastructure/chain-command.repository.js';
import { RedisActivationEnvelope } from '../../../src/modules/blockchain/infrastructure/redis-activation-envelope.js';
import { CommerceService } from '../../../src/modules/commerce-payment/application/commerce.service.js';
import { CommerceRepository } from '../../../src/modules/commerce-payment/infrastructure/commerce.repository.js';
import { FakePaymentGateway } from '../../../src/modules/commerce-payment/infrastructure/fake-payment.gateway.js';
import { seedBaseline } from '../../../src/platform/database/seed-baseline.js';

describe('customer commerce and payment flow', () => {
  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let pool: Pool;
  let redis: Redis;
  let service: CommerceService;
  const customer = { role: 'CUSTOMER' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000004' };
  const otherCustomer = { ...customer, sub: '00000000-0000-4000-8000-000000000099' };
  const planId = '00000000-0000-4000-8000-000000000301';
  const webhookSecret = 'commerce-integration-secret';

  beforeAll(async () => {
    [postgres, redisContainer] = await Promise.all([
      new PostgreSqlContainer('pgvector/pgvector:pg15')
        .withDatabase('emukey_commerce_test')
        .withUsername('emukey')
        .withPassword('test-password')
        .start(),
      new RedisContainer('redis:8.2-alpine').start(),
    ]);
    pool = new Pool({ connectionString: postgres.getConnectionUri() });
    await pool.query(await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
    await seedBaseline(pool, 'Commerce-test@123');
    redis = new Redis(redisContainer.getConnectionUrl());
    const envelopes = new RedisActivationEnvelope(redis, '00'.repeat(32));
    service = new CommerceService(
      new CommerceRepository(pool),
      new FakePaymentGateway(webhookSecret),
      envelopes,
      new ActivationEnvelopeRecoveryService(new ChainCommandRepository(pool), envelopes),
      {
        chainId: 31_337,
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        network: 'hardhat',
      },
    );
  }, 120_000);

  afterAll(async () => {
    if (redis) await redis.quit();
    if (pool) await pool.end();
    await Promise.all([postgres?.stop(), redisContainer?.stop()]);
  });

  it('uses a customer-scoped idempotency key and enforces ownership', async () => {
    const idempotencyKey = '00000000-0000-4000-8000-000000000701';
    const first = await service.createOrder(customer, idempotencyKey, undefined, { planId });
    const repeated = await service.createOrder(customer, idempotencyKey, undefined, { planId });
    expect(repeated.id).toBe(first.id);
    expect(first.customerUserId).toBe(customer.sub);

    await expect(service.findOrder(otherCustomer, first.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const stored = await pool.query<{
      customer_user_id: string;
      idempotency_key: string;
      ipn_delivery_grace_seconds: number;
    }>(
      `SELECT customer_user_id, idempotency_key,
              extract(epoch FROM ipn_accept_until - payment_due_at)::integer
                AS ipn_delivery_grace_seconds
       FROM orders WHERE id=$1`,
      [first.id],
    );
    expect(stored.rows[0]).toEqual({
      customer_user_id: customer.sub,
      idempotency_key: idempotencyKey,
      ipn_delivery_grace_seconds: 86_400,
    });
  });

  it('accepts payment and creates a license owned by the customer account', async () => {
    const order = await service.createOrder(customer, '00000000-0000-4000-8000-000000000702', undefined, { planId });
    await service.acceptTerms(customer, order.id, {
      termsHash: order.termsHashSnapshot,
      termsVersion: order.termsVersionSnapshot,
    });
    const checkout = await service.checkout(customer, order.id);
    const providerClock = await pool.query<{ occurred_at: Date }>(
      "SELECT statement_timestamp() + interval '1 second' AS occurred_at",
    );
    const payment = await service.ingestIpn(
      {
        amountVnd: order.priceVndSnapshot,
        eventId: 'customer-payment-event-1',
        occurredAt: providerClock.rows[0]!.occurred_at.toISOString(),
        providerReference: checkout.checkoutReference,
      },
      webhookSecret,
    );
    expect(payment).toMatchObject({ activationRequired: true, classification: 'MATCHED' });
    const license = await pool.query<{ customer_user_id: string }>(
      'SELECT customer_user_id FROM licenses WHERE origin_order_id=$1',
      [order.id],
    );
    expect(license.rows[0]?.customer_user_id).toBe(customer.sub);
  });
});
