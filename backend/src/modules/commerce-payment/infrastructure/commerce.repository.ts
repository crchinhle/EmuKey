import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import { keccak256, stringToHex, type Hex } from 'viem';

import { AuditWriter } from '../../../platform/audit/audit-writer.js';
import { canonicalizeEntitlements } from '../../../platform/crypto/license-crypto.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { VerifiedPaymentEvent } from '../application/ports/payment-gateway.port.js';

export interface OrderRecord {
  billingCycleSnapshot: string;
  createdAt: Date;
  currency: string;
  customerUserId: string;
  durationMonthsSnapshot: number;
  entitlementsSnapshot: Record<string, unknown>;
  id: string;
  licenseId: string | null;
  maxActiveDevicesSnapshot: number;
  orderNumber: string;
  orderStatus: string;
  orderType: 'NEW_PURCHASE' | 'RENEWAL';
  paymentDueAt: Date;
  planCommitmentSnapshot: Hex;
  planId: string;
  planNameSnapshot: string;
  planVersionSnapshot: number;
  priceVndSnapshot: number;
  productId: string;
  productNameSnapshot: string;
  providerNameSnapshot: string;
  providerUserId: string;
  publicLicenseId: string | null;
  targetLicenseId: string | null;
  termsAcceptedAt: Date | null;
  termsHashSnapshot: Hex;
  termsVersionSnapshot: number;
}

export interface CheckoutPreparation {
  amountVnd: number;
  attemptId: string;
  checkoutReference: string;
  existing: boolean;
  expiresAt: Date;
  orderId: string;
}

export interface PaymentHistoryRecord {
  amountVnd: number;
  classification: string;
  orderId: string;
  orderNumber: string;
  orderType: OrderRecord['orderType'];
  planNameSnapshot: string;
  productNameSnapshot: string;
  providerEventId: string;
  providerTransactionReference: string | null;
  receivedAt: Date;
  reviewStatus: string | null;
  transactionId: string;
}

export interface PaymentReceiptRecord {
  amountVnd: number;
  currency: string;
  orderId: string;
  orderNumber: string;
  orderType: OrderRecord['orderType'];
  paidAt: Date;
  planNameSnapshot: string;
  productNameSnapshot: string;
  providerNameSnapshot: string;
  providerTransactionReference: string | null;
  transactionId: string;
}

export interface PaymentReviewRecord {
  amountVnd: number;
  classification: string;
  id: string;
  providerEventId: string;
  providerTransactionReference: string | null;
  receivedAt: Date;
  reviewedAt: Date | null;
  reviewReason: string | null;
  reviewStatus: string | null;
}

export interface ChainConfiguration {
  chainId: number;
  contractAddress: string;
  network: string;
}

export interface IssuanceMaterial {
  activationCommitment: Hex;
  commandId: string;
  licenseId: string;
  payload: Record<string, unknown>;
  payloadHash: Hex;
}

export interface PaymentIngestResult {
  activationRequired?: boolean;
  classification: 'AMOUNT_MISMATCH' | 'DUPLICATE' | 'MATCHED' | 'UNMATCHED';
  commandId?: string;
  licenseId?: string;
  transactionId: string;
}

function hex(value: unknown): Hex {
  if (!Buffer.isBuffer(value) || value.length !== 32) {
    throw new Error('INVALID_DATABASE_HASH');
  }
  return `0x${value.toString('hex')}`;
}

function date(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function optionalDate(value: unknown): Date | null {
  return value === null || value === undefined ? null : date(value);
}

function mapOrder(row: Record<string, unknown>): OrderRecord {
  return {
    billingCycleSnapshot: String(row.billing_cycle_snapshot),
    createdAt: date(row.created_at),
    currency: String(row.currency),
    customerUserId: String(row.customer_user_id),
    durationMonthsSnapshot: Number(row.duration_months_snapshot),
    entitlementsSnapshot: row.entitlements_snapshot as Record<string, unknown>,
    id: String(row.id),
    licenseId: typeof row.license_id === 'string' ? row.license_id : null,
    maxActiveDevicesSnapshot: Number(row.max_active_devices_snapshot),
    orderNumber: String(row.order_number),
    orderStatus: String(row.order_status),
    orderType: row.order_type as OrderRecord['orderType'],
    paymentDueAt: date(row.payment_due_at),
    planCommitmentSnapshot: hex(row.plan_commitment_snapshot),
    planId: String(row.plan_id),
    planNameSnapshot: String(row.plan_name_snapshot),
    planVersionSnapshot: Number(row.plan_version_snapshot),
    priceVndSnapshot: Number(row.price_vnd_snapshot),
    productId: String(row.product_id),
    productNameSnapshot: String(row.product_name_snapshot),
    providerNameSnapshot: String(row.provider_name_snapshot),
    providerUserId: String(row.provider_user_id),
    publicLicenseId:
      typeof row.public_license_id === 'string' ? row.public_license_id : null,
    targetLicenseId:
      typeof row.target_license_id === 'string' ? row.target_license_id : null,
    termsAcceptedAt: optionalDate(row.terms_accepted_at),
    termsHashSnapshot: hex(row.terms_hash_snapshot),
    termsVersionSnapshot: Number(row.terms_version_snapshot),
  };
}

function mapPaymentReview(row: Record<string, unknown>): PaymentReviewRecord {
  return {
    amountVnd: Number(row.amount_vnd),
    classification: String(row.classification),
    id: String(row.id),
    providerEventId: String(row.provider_event_id),
    providerTransactionReference:
      typeof row.provider_transaction_ref === 'string'
        ? row.provider_transaction_ref
        : null,
    receivedAt: date(row.received_at),
    reviewedAt: optionalDate(row.reviewed_at),
    reviewReason: typeof row.review_reason === 'string' ? row.review_reason : null,
    reviewStatus: typeof row.review_status === 'string' ? row.review_status : null,
  };
}

export class CommerceRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit = new AuditWriter(),
    private readonly ipnDeliveryGraceSeconds = 86_400,
  ) {
    if (
      !Number.isSafeInteger(ipnDeliveryGraceSeconds) ||
      ipnDeliveryGraceSeconds <= 0
    ) {
      throw new Error('IPN delivery grace must be a positive integer');
    }
  }

  async createOrder(
    customerUserId: string,
    idempotencyKey: string,
    planId: string,
    targetLicenseId?: string,
    targetActivationCommitment?: Hex,
  ): Promise<OrderRecord> {
    return this.withTransaction(async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
        [`${customerUserId}:${idempotencyKey}`],
      );
      const previous = await client.query<Record<string, unknown>>(
        `SELECT o.*, l.id AS license_id, l.public_license_id
         FROM orders o LEFT JOIN licenses l ON l.origin_order_id = o.id
         WHERE o.customer_user_id = $1 AND o.idempotency_key = $2
         FOR UPDATE OF o`,
        [customerUserId, idempotencyKey],
      );
      if (previous.rows[0]) {
        const order = mapOrder(previous.rows[0]);
        if (
          order.planId !== planId ||
          order.targetLicenseId !== (targetLicenseId ?? null)
        ) {
          throw new Error('IDEMPOTENCY_CONFLICT');
        }
        return order;
      }

      const selected = await client.query<Record<string, unknown>>(
        `SELECT pl.*, p.name AS product_name,
                u.organization_name AS provider_name
         FROM plans pl
         JOIN products p
           ON p.id = pl.product_id AND p.provider_user_id = pl.provider_user_id
         JOIN users u ON u.id = pl.provider_user_id
         WHERE pl.id = $1 AND pl.status = 'PUBLISHED'
           AND p.status = 'PUBLISHED'
         FOR SHARE OF pl, p`,
        [planId],
      );
      const plan = selected.rows[0];
      if (!plan) throw new Error('PLAN_NOT_FOUND');
      if (targetLicenseId) {
        const target = await client.query(
          `SELECT id FROM licenses
           WHERE id = $1 AND activation_commitment = decode($2, 'hex')
             AND provider_user_id = $3 AND product_id = $4
             AND customer_user_id = $5
             AND status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED')
           FOR SHARE`,
          [
            targetLicenseId,
            targetActivationCommitment?.slice(2) ?? '',
            plan.provider_user_id,
            plan.product_id,
            customerUserId,
          ],
        );
        if (!target.rows[0]) throw new Error('RENEWAL_LICENSE_NOT_FOUND');
      }

      const id = randomUUID();
      const orderNumber = `EMU-${id.replaceAll('-', '').slice(0, 20).toUpperCase()}`;
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO orders
          (id, order_number, idempotency_key, customer_user_id, provider_user_id,
           product_id, plan_id, target_license_id,
           order_type, provider_name_snapshot, product_name_snapshot,
           plan_name_snapshot, plan_version_snapshot, price_vnd_snapshot,
           billing_cycle_snapshot, duration_months_snapshot,
           max_active_devices_snapshot, entitlements_snapshot,
           terms_version_snapshot, terms_hash_snapshot,
           plan_commitment_snapshot, payment_due_at, ipn_accept_until)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
           $13, $14, $15, $16, $17, $18, $19, decode($20, 'hex'),
           decode($21, 'hex'), statement_timestamp() + interval '30 minutes',
           statement_timestamp() + interval '30 minutes' +
             ($22::integer * interval '1 second'))
         RETURNING *`,
        [
          id,
          orderNumber,
          idempotencyKey,
          customerUserId,
          plan.provider_user_id,
          plan.product_id,
          plan.id,
          targetLicenseId ?? null,
          targetLicenseId ? 'RENEWAL' : 'NEW_PURCHASE',
          plan.provider_name,
          plan.product_name,
          plan.name,
          plan.version,
          plan.price_vnd,
          plan.billing_cycle,
          plan.duration_months,
          plan.max_active_devices,
          JSON.stringify(plan.entitlements),
          plan.terms_version,
          hex(plan.terms_hash).slice(2),
          hex(plan.plan_commitment).slice(2),
          this.ipnDeliveryGraceSeconds,
        ],
      );
      const order = mapOrder(result.rows[0] ?? {});
      await this.audit.write(client, {
        action: 'ORDER_CREATED',
        actorRole: 'CUSTOMER',
        actorUserId: customerUserId,
        metadata: { orderType: order.orderType },
        targetId: order.id,
        targetType: 'ORDER',
      });
      return order;
    });
  }

  async findOrder(
    customerUserId: string,
    id: string,
  ): Promise<OrderRecord | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT o.*, l.id AS license_id, l.public_license_id
       FROM orders o LEFT JOIN licenses l ON l.origin_order_id = o.id
       WHERE o.id = $1 AND o.customer_user_id = $2`,
      [id, customerUserId],
    );
    return result.rows[0] ? mapOrder(result.rows[0]) : null;
  }

  async listCustomerOrders(customerUserId: string): Promise<OrderRecord[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT o.*, l.id AS license_id, l.public_license_id
       FROM orders o LEFT JOIN licenses l ON l.origin_order_id = o.id
       WHERE o.customer_user_id = $1
       ORDER BY o.created_at DESC`,
      [customerUserId],
    );
    return result.rows.map(mapOrder);
  }

  async acceptTerms(
    customerUserId: string,
    id: string,
    version: number,
    hash: Hex,
  ): Promise<OrderRecord> {
    return this.withTransaction(async (client) => {
      const current = await client.query<Record<string, unknown>>(
        'SELECT * FROM orders WHERE id = $1 AND customer_user_id = $2 FOR UPDATE',
        [id, customerUserId],
      );
      if (!current.rows[0]) throw new Error('ORDER_NOT_FOUND');
      const order = mapOrder(current.rows[0]);
      if (
        order.orderStatus !== 'WAITING_TERMS_ACCEPTANCE' ||
        order.termsVersionSnapshot !== version ||
        order.termsHashSnapshot.toLowerCase() !== hash.toLowerCase()
      ) {
        throw new Error('ORDER_TERMS_MISMATCH');
      }
      const result = await client.query<Record<string, unknown>>(
        `UPDATE orders
         SET order_status = 'WAITING_PAYMENT', terms_accepted_at = now(),
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      const accepted = mapOrder(result.rows[0] ?? {});
      await this.audit.write(client, {
        action: 'ORDER_TERMS_ACCEPTED',
        actorRole: 'CUSTOMER',
        actorUserId: customerUserId,
        metadata: { termsHash: hash, termsVersion: version },
        targetId: id,
        targetType: 'ORDER',
      });
      return accepted;
    });
  }

  async cancelOrder(customerUserId: string, id: string): Promise<OrderRecord> {
    return this.withTransaction(async (client) => {
      const current = await client.query<Record<string, unknown>>(
        'SELECT * FROM orders WHERE id = $1 AND customer_user_id = $2 FOR UPDATE',
        [id, customerUserId],
      );
      if (!current.rows[0]) throw new Error('ORDER_NOT_FOUND');
      if (
        !['WAITING_TERMS_ACCEPTANCE', 'WAITING_PAYMENT'].includes(
          String(current.rows[0].order_status),
        )
      ) {
        throw new Error('ORDER_NOT_CANCELLABLE');
      }
      const result = await client.query<Record<string, unknown>>(
        `UPDATE orders
         SET order_status = 'CANCELLED', cancelled_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      const order = mapOrder(result.rows[0] ?? {});
      await this.audit.write(client, {
        action: 'ORDER_CANCELLED',
        actorRole: 'CUSTOMER',
        actorUserId: customerUserId,
        targetId: id,
        targetType: 'ORDER',
      });
      return order;
    });
  }

  async prepareCheckout(
    customerUserId: string,
    id: string,
  ): Promise<CheckoutPreparation> {
    return this.withTransaction(async (client) => {
      const orderResult = await client.query<Record<string, unknown>>(
        `SELECT *, payment_due_at <= now() AS payment_expired FROM orders
         WHERE id = $1 AND customer_user_id = $2 FOR UPDATE`,
        [id, customerUserId],
      );
      const row = orderResult.rows[0];
      if (!row) throw new Error('ORDER_NOT_FOUND');
      if (row.order_status !== 'WAITING_PAYMENT') {
        throw new Error('ORDER_NOT_WAITING_PAYMENT');
      }
      if (row.payment_expired === true) {
        throw new Error('ORDER_PAYMENT_EXPIRED');
      }
      const existing = await client.query<Record<string, unknown>>(
        `SELECT * FROM payment_attempts
         WHERE order_id = $1 AND status = 'PENDING' AND expires_at > now()
         ORDER BY attempt_no DESC LIMIT 1`,
        [id],
      );
      if (existing.rows[0]) {
        return {
          amountVnd: Number(existing.rows[0].amount_vnd),
          attemptId: String(existing.rows[0].id),
          checkoutReference: String(existing.rows[0].provider_reference),
          existing: true,
          expiresAt: date(existing.rows[0].expires_at),
          orderId: id,
        };
      }
      const attemptId = randomUUID();
      const checkoutReference = attemptId;
      const created = await client.query<Record<string, unknown>>(
        `INSERT INTO payment_attempts
          (id, order_id, attempt_no, provider_reference, amount_vnd, expires_at)
         SELECT $1, $2, COALESCE(MAX(attempt_no), 0) + 1,
                $3, $4, LEAST($5::timestamptz, now() + interval '15 minutes')
         FROM payment_attempts WHERE order_id = $2
         RETURNING *`,
        [
          attemptId,
          id,
          checkoutReference,
          row.price_vnd_snapshot,
          row.payment_due_at,
        ],
      );
      return {
        amountVnd: Number(created.rows[0]?.amount_vnd),
        attemptId,
        checkoutReference,
        existing: false,
        expiresAt: date(created.rows[0]?.expires_at),
        orderId: id,
      };
    });
  }

  async failCheckout(attemptId: string): Promise<void> {
    await this.pool.query(
      `UPDATE payment_attempts
       SET status = 'FAILED', failed_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'PENDING'`,
      [attemptId],
    );
  }

  async ingestPayment(
    event: VerifiedPaymentEvent,
    rawPayload: unknown,
    issuance: IssuanceMaterial,
    chain: ChainConfiguration,
  ): Promise<PaymentIngestResult> {
    return this.withTransaction(async (client) => {
      const transactionId = randomUUID();
      const evidencePayload = JSON.stringify({
        payload: rawPayload,
        protocolVersion: event.protocolVersion,
      });
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
        [`payment-event:${event.eventId}`],
      );
      const previous = await client.query<{ id: string }>(
        'SELECT id FROM payment_transactions WHERE provider_event_id = $1',
        [event.eventId],
      );
      if (previous.rows[0]) {
        return {
          classification: 'DUPLICATE',
          transactionId: String(previous.rows[0]?.id),
        };
      }

      const attemptResult = await client.query<Record<string, unknown>>(
        `SELECT pa.*, o.*, provider.provider_chain_address,
                statement_timestamp() < o.ipn_accept_until AS received_before_cutoff,
                pa.id AS payment_attempt_id,
                pa.amount_vnd AS payment_attempt_amount_vnd,
                pa.status AS payment_attempt_status,
                pa.created_at AS payment_attempt_created_at,
                pa.expires_at AS payment_attempt_expires_at,
                pa.superseded_at AS payment_attempt_superseded_at,
                o.id AS matched_order_id
         FROM payment_attempts pa
         JOIN orders o ON o.id = pa.order_id
         JOIN users provider ON provider.id = o.provider_user_id
         WHERE pa.provider_reference = $1
         FOR UPDATE OF pa, o`,
        [event.providerReference],
      );
      const row = attemptResult.rows[0];
      if (!row) {
        await client.query(
          `INSERT INTO payment_transactions
            (id, provider_event_id, provider_transaction_ref, amount_minor,
             currency, classification, review_status, review_reason,
             raw_payload, provider_occurred_at)
           VALUES ($1, $2, $3, $4, 'VND', 'UNMATCHED', 'OPEN',
                   'NO_MATCHING_PAYMENT_ATTEMPT', $5, $6)`,
          [
            transactionId,
            event.eventId,
            event.transactionReference ?? null,
            event.amountVnd,
            evidencePayload,
            event.occurredAt,
          ],
        );
        return { classification: 'UNMATCHED', transactionId };
      }
      const orderId = String(row.matched_order_id);
      const attemptId = String(row.payment_attempt_id);
      if (Number(row.payment_attempt_amount_vnd) !== event.amountVnd) {
        await client.query(
          `INSERT INTO payment_transactions
            (id, provider_event_id, provider_transaction_ref, order_id,
             payment_attempt_id, amount_minor, currency, classification,
             review_status, review_reason, raw_payload, provider_occurred_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'VND', 'AMOUNT_MISMATCH',
                   'OPEN', 'PAYMENT_AMOUNT_MISMATCH', $7, $8)`,
          [
            transactionId,
            event.eventId,
            event.transactionReference ?? null,
            orderId,
            attemptId,
            event.amountVnd,
            evidencePayload,
            event.occurredAt,
          ],
        );
        return { classification: 'AMOUNT_MISMATCH', transactionId };
      }
      if (
        row.order_status === 'PAYMENT_ACCEPTED' ||
        row.payment_attempt_status === 'SUCCEEDED'
      ) {
        const original = await client.query<{ id: string }>(
          `SELECT id FROM payment_transactions
           WHERE fulfillment_order_id = $1
             AND fulfillment_payment_attempt_id = $2`,
          [orderId, attemptId],
        );
        if (!original.rows[0]) throw new Error('PAYMENT_EFFECT_NOT_FOUND');
        await client.query(
          `INSERT INTO payment_transactions
            (id, provider_event_id, provider_transaction_ref, order_id,
             payment_attempt_id, amount_minor, currency, classification,
             duplicate_of_transaction_id, raw_payload, provider_occurred_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'VND', 'DUPLICATE', $7, $8, $9)`,
          [
            transactionId,
            event.eventId,
            event.transactionReference ?? null,
            orderId,
            attemptId,
            event.amountVnd,
            original.rows[0].id,
            evidencePayload,
            event.occurredAt,
          ],
        );
        return { classification: 'DUPLICATE', transactionId };
      }
      const occurredAt = event.occurredAt.getTime();
      const eligible =
        row.order_status === 'WAITING_PAYMENT' &&
        ['PENDING', 'EXPIRED', 'SUPERSEDED'].includes(
          String(row.payment_attempt_status),
        ) &&
        row.terms_accepted_at !== null &&
        occurredAt >= date(row.terms_accepted_at).getTime() &&
        occurredAt >= date(row.payment_attempt_created_at).getTime() &&
        occurredAt < date(row.payment_attempt_expires_at).getTime() &&
        occurredAt < date(row.payment_due_at).getTime() &&
        (row.payment_attempt_status !== 'SUPERSEDED' ||
          occurredAt < date(row.payment_attempt_superseded_at).getTime()) &&
        row.received_before_cutoff === true;
      if (!eligible) {
        await client.query(
          `INSERT INTO payment_transactions
            (id, provider_event_id, provider_transaction_ref, order_id,
             payment_attempt_id, amount_minor, currency, classification,
             review_status, review_reason, raw_payload, provider_occurred_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'VND', 'UNMATCHED', 'OPEN',
                   'PAYMENT_OUTSIDE_ACCEPTED_WINDOW', $7, $8)`,
          [
            transactionId,
            event.eventId,
            event.transactionReference ?? null,
            orderId,
            attemptId,
            event.amountVnd,
            evidencePayload,
            event.occurredAt,
          ],
        );
        return { classification: 'UNMATCHED', transactionId };
      }

      await client.query(
        `INSERT INTO payment_transactions
          (id, provider_event_id, provider_transaction_ref, order_id,
           payment_attempt_id, amount_minor, currency, classification,
           raw_payload, provider_occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'VND', 'MATCHED', $7, $8)`,
        [
          transactionId,
          event.eventId,
          event.transactionReference ?? null,
          orderId,
          attemptId,
          event.amountVnd,
          evidencePayload,
          event.occurredAt,
        ],
      );
      await client.query(
        `UPDATE payment_attempts
         SET status = 'SUCCEEDED'
         WHERE id = $1`,
        [attemptId],
      );
      await client.query(
        `UPDATE payment_attempts
         SET status = 'EXPIRED'
         WHERE order_id = $1 AND id <> $2 AND status = 'PENDING'
           AND expires_at <= statement_timestamp()`,
        [orderId, attemptId],
      );
      await client.query(
        `UPDATE payment_attempts
         SET status = 'SUPERSEDED'
         WHERE order_id = $1 AND id <> $2 AND status = 'PENDING'`,
        [orderId, attemptId],
      );
      await client.query(
        `UPDATE orders
         SET order_status = 'PAYMENT_ACCEPTED'
         WHERE id = $1`,
        [orderId],
      );

      let licenseId: string;
      let expiresAt: Date;
      if (row.order_type === 'NEW_PURCHASE') {
        licenseId = issuance.licenseId;
        const publicId = `EMU-${licenseId.replaceAll('-', '').slice(0, 20).toUpperCase()}`;
        const insertedLicense = await client.query<{ expires_at: Date }>(
          `INSERT INTO licenses
            (id, public_license_id, origin_order_id, provider_user_id, customer_user_id,
             product_id, plan_id,
             plan_commitment, period_start, expires_at, max_active_devices,
             activation_commitment, activation_key_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, decode($8, 'hex'),
                   $9, $9::timestamptz + make_interval(months => $10), $11,
                   decode($12, 'hex'), 1)
           RETURNING expires_at`,
          [
            licenseId,
            publicId,
            orderId,
            row.provider_user_id,
            row.customer_user_id,
            row.product_id,
            row.plan_id,
            hex(row.plan_commitment_snapshot).slice(2),
            event.occurredAt,
            Number(row.duration_months_snapshot),
            Number(row.max_active_devices_snapshot),
            issuance.activationCommitment.slice(2),
          ],
        );
        expiresAt = insertedLicense.rows[0]!.expires_at;
      } else {
        licenseId = String(row.target_license_id);
        const renewed = await client.query<{ expires_at: Date }>(
          `SELECT expires_at + make_interval(months => $2) AS expires_at
           FROM licenses WHERE id = $1 FOR UPDATE`,
          [licenseId, Number(row.duration_months_snapshot)],
        );
        expiresAt = renewed.rows[0]!.expires_at;
      }

      const commandPayload =
        row.order_type === 'NEW_PURCHASE'
          ? {
              activationCommitment: issuance.activationCommitment,
              commandId: issuance.commandId,
              expiresAt: expiresAt.toISOString(),
              keyVersion: 1,
              licenseId,
              maxActiveDevices: Number(row.max_active_devices_snapshot),
              planCommitment: hex(row.plan_commitment_snapshot),
              planId: String(row.plan_id),
              planVersion: Number(row.plan_version_snapshot),
              productId: String(row.product_id),
              protocolVersion: 1,
              providerAddress: String(row.provider_chain_address),
            }
          : {
              commandId: issuance.commandId,
              expiresAt: expiresAt.toISOString(),
              licenseId,
              protocolVersion: 1,
            };
      const commandPayloadHash = keccak256(
        stringToHex(canonicalizeEntitlements(commandPayload)),
      );
      let commandSequence = 1;
      let predecessorCommandId: string | null = null;
      let basisChainEventId: string | null = null;
      if (row.order_type === 'RENEWAL') {
        const predecessor = await client.query<{
          basis_chain_event_id: string | null;
          id: string;
          license_command_sequence: string;
        }>(
          `SELECT latest.id, latest.license_command_sequence,
                  (
                    SELECT confirmed.confirmation_chain_event_id
                    FROM chain_commands confirmed
                    WHERE confirmed.license_id = latest.license_id
                      AND confirmed.status = 'CONFIRMED'
                      AND confirmed.license_command_sequence <= latest.license_command_sequence
                    ORDER BY confirmed.license_command_sequence DESC
                    LIMIT 1
                  ) AS basis_chain_event_id
           FROM chain_commands latest
           WHERE latest.license_id = $1
           ORDER BY latest.license_command_sequence DESC
           LIMIT 1
           FOR UPDATE`,
          [licenseId],
        );
        const previous = predecessor.rows[0];
        if (!previous || !previous.basis_chain_event_id) {
          throw new Error('RENEWAL_CANONICAL_BASIS_NOT_FOUND');
        }
        commandSequence = Number(previous.license_command_sequence) + 1;
        predecessorCommandId = previous.id;
        basisChainEventId = previous.basis_chain_event_id;
      }

      await client.query(
        `INSERT INTO chain_commands
          (id, idempotency_key, command_type, provider_user_id, order_id,
           license_id, license_command_sequence, predecessor_command_id,
           basis_chain_event_id, network, chain_id, contract_address, payload,
           payload_hash)
         VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 decode($13, 'hex'))`,
        [
          issuance.commandId,
          row.order_type === 'NEW_PURCHASE' ? 'ISSUE_LICENSE' : 'RENEW_LICENSE',
          row.provider_user_id,
          orderId,
          licenseId,
          commandSequence,
          predecessorCommandId,
          basisChainEventId,
          chain.network.toLowerCase(),
          chain.chainId,
          chain.contractAddress.toLowerCase(),
          JSON.stringify(commandPayload),
          commandPayloadHash.slice(2),
        ],
      );
      await this.audit.write(client, {
        action: 'PAYMENT_ACCEPTED',
        actorRole: 'CUSTOMER',
        actorUserId: String(row.customer_user_id),
        metadata: { classification: 'MATCHED', orderType: row.order_type },
        targetId: orderId,
        targetType: 'ORDER',
      });
      return {
        activationRequired: row.order_type === 'NEW_PURCHASE',
        classification: 'MATCHED',
        commandId: issuance.commandId,
        licenseId,
        transactionId,
      };
    });
  }

  async listPaymentHistory(actor: AuthPrincipal): Promise<PaymentHistoryRecord[]> {
    const scope =
      actor.role === 'PROVIDER_ADMIN'
        ? 'o.provider_user_id = $1'
        : actor.role === 'CUSTOMER'
          ? 'o.customer_user_id = $1'
          : 'TRUE';
    const parameters = scope === 'TRUE' ? [] : [actor.sub];
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT pt.id AS transaction_id, pt.provider_event_id,
              pt.provider_transaction_ref, pt.amount_minor AS amount_vnd,
              pt.classification,
              pt.review_status, pt.received_at, o.id AS order_id,
              o.order_number, o.order_type, o.product_name_snapshot,
              o.plan_name_snapshot
       FROM payment_transactions pt
       JOIN orders o ON o.id = pt.order_id
       WHERE ${scope}
       ORDER BY pt.received_at DESC`,
      parameters,
    );
    return result.rows.map((row) => ({
      amountVnd: Number(row.amount_vnd),
      classification: String(row.classification),
      orderId: String(row.order_id),
      orderNumber: String(row.order_number),
      orderType: row.order_type as OrderRecord['orderType'],
      planNameSnapshot: String(row.plan_name_snapshot),
      productNameSnapshot: String(row.product_name_snapshot),
      providerEventId: String(row.provider_event_id),
      providerTransactionReference:
        typeof row.provider_transaction_ref === 'string'
          ? row.provider_transaction_ref
          : null,
      receivedAt: date(row.received_at),
      reviewStatus:
        typeof row.review_status === 'string' ? row.review_status : null,
      transactionId: String(row.transaction_id),
    }));
  }

  async getPaymentReceipt(
    actor: AuthPrincipal,
    transactionId: string,
  ): Promise<PaymentReceiptRecord | null> {
    const scope =
      actor.role === 'PROVIDER_ADMIN'
        ? 'o.provider_user_id = $2'
        : actor.role === 'CUSTOMER'
          ? 'o.customer_user_id = $2'
          : 'TRUE';
    const parameters = scope === 'TRUE' ? [transactionId] : [transactionId, actor.sub];
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT pt.id AS transaction_id, pt.provider_transaction_ref,
              pt.amount_minor AS amount_vnd, pt.received_at, o.id AS order_id,
              o.order_number, o.order_type, o.currency,
              o.provider_name_snapshot, o.product_name_snapshot,
              o.plan_name_snapshot
       FROM payment_transactions pt
       JOIN orders o ON o.id = pt.order_id
       WHERE pt.id = $1 AND pt.classification = 'MATCHED' AND ${scope}`,
      parameters,
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      amountVnd: Number(row.amount_vnd),
      currency: String(row.currency),
      orderId: String(row.order_id),
      orderNumber: String(row.order_number),
      orderType: row.order_type as OrderRecord['orderType'],
      paidAt: date(row.received_at),
      planNameSnapshot: String(row.plan_name_snapshot),
      productNameSnapshot: String(row.product_name_snapshot),
      providerNameSnapshot: String(row.provider_name_snapshot),
      providerTransactionReference:
        typeof row.provider_transaction_ref === 'string'
          ? row.provider_transaction_ref
          : null,
      transactionId: String(row.transaction_id),
    };
  }

  async listPaymentReview(): Promise<PaymentReviewRecord[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, provider_event_id, provider_transaction_ref,
              amount_minor AS amount_vnd,
              classification, review_status, review_reason, received_at,
              reviewed_at
       FROM payment_transactions
       WHERE review_status = 'OPEN' ORDER BY received_at`,
    );
    return result.rows.map(mapPaymentReview);
  }

  async reviewPayment(
    actor: AuthPrincipal,
    id: string,
    status: 'CLOSED_NO_ACTION' | 'RESOLVED',
    reason: string,
  ): Promise<PaymentReviewRecord> {
    return this.withTransaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `UPDATE payment_transactions
         SET review_status = $2, review_reason = $3,
             reviewed_by_user_id = $4, reviewed_at = now()
         WHERE id = $1 AND review_status = 'OPEN'
         RETURNING id, provider_event_id, provider_transaction_ref,
                   amount_minor AS amount_vnd,
                   classification, review_status, review_reason, received_at,
                   reviewed_at`,
        [id, status, reason, actor.sub],
      );
      if (!result.rows[0]) throw new Error('PAYMENT_REVIEW_NOT_FOUND');
      await this.audit.write(client, {
        action: 'PAYMENT_REVIEWED',
        actorRole: actor.role,
        actorUserId: actor.sub,
        metadata: { status },
        reason,
        targetId: id,
        targetType: 'PAYMENT_TRANSACTION',
      });
      return mapPaymentReview(result.rows[0]);
    });
  }

  private async withTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await work(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
