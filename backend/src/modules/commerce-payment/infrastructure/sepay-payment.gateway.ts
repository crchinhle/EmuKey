import { timingSafeEqual } from 'node:crypto';

import { SePayPgClient } from 'sepay-pg-node';

import {
  PAYMENT_IPN_PROTOCOL_VERSION,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentGatewayPort,
  type PaymentIpnInput,
  type VerifiedPaymentEvent,
} from '../application/ports/payment-gateway.port.js';

export interface SePayPaymentGatewayOptions {
  environment: 'production' | 'sandbox';
  merchantId: string;
  secretKey: string;
  webAppUrl: string;
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_PAYMENT_PAYLOAD');
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('INVALID_PAYMENT_PAYLOAD');
  }
  return value.trim();
}

function positiveVnd(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('INVALID_PAYMENT_PAYLOAD');
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('INVALID_PAYMENT_PAYLOAD');
  }
  return amount;
}

function equalSecret(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) return false;
  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function resultUrl(
  webAppUrl: string,
  orderId: string,
  result: 'cancel' | 'error' | 'success',
): string {
  const url = new URL(
    `/buyer/orders/${encodeURIComponent(orderId)}/payment`,
    webAppUrl,
  );
  url.searchParams.set('sepay', result);
  return url.toString();
}

export class SePayPaymentGateway implements PaymentGatewayPort {
  private readonly client: SePayPgClient;

  constructor(private readonly options: SePayPaymentGatewayOptions) {
    this.client = new SePayPgClient({
      env: options.environment,
      merchant_id: options.merchantId,
      secret_key: options.secretKey,
    });
  }

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const checkoutFields = this.client.checkout.initOneTimePaymentFields({
      operation: 'PURCHASE',
      payment_method: 'BANK_TRANSFER',
      order_invoice_number: input.attemptId,
      order_amount: input.amountVnd,
      currency: 'VND',
      order_description: `EmuKey order ${input.orderId}`,
      success_url: resultUrl(this.options.webAppUrl, input.orderId, 'success'),
      error_url: resultUrl(this.options.webAppUrl, input.orderId, 'error'),
      cancel_url: resultUrl(this.options.webAppUrl, input.orderId, 'cancel'),
    });

    return Promise.resolve({
      checkoutFields: Object.fromEntries(
        Object.entries(checkoutFields).map(([name, value]) => [
          name,
          String(value),
        ]),
      ),
      checkoutMethod: 'POST',
      checkoutReference: input.attemptId,
      checkoutUrl: this.client.checkout.initCheckoutUrl(),
    });
  }

  verifyIpn(input: PaymentIpnInput): Promise<VerifiedPaymentEvent> {
    try {
      if (!equalSecret(input.signature, this.options.secretKey)) {
        throw new Error('INVALID_PAYMENT_SIGNATURE');
      }

      const payload = record(input.payload);
      const order = record(payload.order);
      const transaction = record(payload.transaction);
      if (
        payload.notification_type !== 'ORDER_PAID' ||
        order.order_status !== 'CAPTURED' ||
        order.order_currency !== 'VND' ||
        transaction.transaction_status !== 'APPROVED' ||
        transaction.transaction_type !== 'PAYMENT' ||
        transaction.transaction_currency !== 'VND'
      ) {
        throw new Error('INVALID_PAYMENT_PAYLOAD');
      }

      const amountVnd = positiveVnd(order.order_amount);
      if (positiveVnd(transaction.transaction_amount) !== amountVnd) {
        throw new Error('INVALID_PAYMENT_PAYLOAD');
      }
      if (
        !Number.isSafeInteger(payload.timestamp) ||
        Number(payload.timestamp) <= 0
      ) {
        throw new Error('INVALID_PAYMENT_PAYLOAD');
      }

      return Promise.resolve({
        amountVnd,
        eventId: nonEmptyString(transaction.id),
        occurredAt: new Date(Number(payload.timestamp) * 1_000),
        protocolVersion: PAYMENT_IPN_PROTOCOL_VERSION,
        providerReference: nonEmptyString(order.order_invoice_number),
        transactionReference: nonEmptyString(transaction.transaction_id),
      });
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('INVALID_PAYMENT_PAYLOAD'));
    }
  }
}
