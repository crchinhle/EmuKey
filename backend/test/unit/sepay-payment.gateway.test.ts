import { describe, expect, it } from 'vitest';

import { SePayPaymentGateway } from '../../src/modules/commerce-payment/infrastructure/sepay-payment.gateway.js';

const gateway = new SePayPaymentGateway({
  environment: 'sandbox',
  merchantId: 'SP-TEST-EMUKEY',
  secretKey: 'sandbox-merchant-secret',
  webAppUrl: 'https://demo.emukey.test',
});

describe('SePayPaymentGateway', () => {
  it('creates a signed Sandbox checkout form without exposing the secret key', async () => {
    const checkout = await gateway.createCheckout({
      amountVnd: 199_000,
      attemptId: '959ded01-53f4-4b64-ae49-7f193c939b95',
      orderId: '7f3ce9a4-7216-48ff-9b27-0ea22ec49c50',
    });

    expect(checkout).toMatchObject({
      checkoutMethod: 'POST',
      checkoutReference: '959ded01-53f4-4b64-ae49-7f193c939b95',
      checkoutUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
      checkoutFields: {
        currency: 'VND',
        merchant: 'SP-TEST-EMUKEY',
        operation: 'PURCHASE',
        order_amount: '199000',
        order_invoice_number: '959ded01-53f4-4b64-ae49-7f193c939b95',
        payment_method: 'BANK_TRANSFER',
      },
    });
    expect(checkout.checkoutFields.signature).toBeTruthy();
    expect(JSON.stringify(checkout)).not.toContain('sandbox-merchant-secret');
    expect(checkout.checkoutFields.success_url).toBe(
      'https://demo.emukey.test/buyer/orders/7f3ce9a4-7216-48ff-9b27-0ea22ec49c50/payment?sepay=success',
    );
  });

  it('verifies and normalizes a successful SePay IPN', async () => {
    await expect(
      gateway.verifyIpn({
        signature: 'sandbox-merchant-secret',
        payload: {
          notification_type: 'ORDER_PAID',
          order: {
            id: 'sepay-order-id',
            order_amount: '199000.00',
            order_currency: 'VND',
            order_invoice_number: '959ded01-53f4-4b64-ae49-7f193c939b95',
            order_status: 'CAPTURED',
          },
          timestamp: 1_757_058_220,
          transaction: {
            id: 'sepay-event-id',
            transaction_amount: '199000',
            transaction_currency: 'VND',
            transaction_id: 'BANK-REFERENCE-001',
            transaction_status: 'APPROVED',
            transaction_type: 'PAYMENT',
          },
        },
      }),
    ).resolves.toEqual({
      amountVnd: 199_000,
      eventId: 'sepay-event-id',
      occurredAt: new Date(1_757_058_220_000),
      protocolVersion: 1,
      providerReference: '959ded01-53f4-4b64-ae49-7f193c939b95',
      transactionReference: 'BANK-REFERENCE-001',
    });
  });

  it('rejects an invalid IPN secret or a non-final payment payload', async () => {
    await expect(
      gateway.verifyIpn({ payload: {}, signature: 'wrong-secret' }),
    ).rejects.toThrow('INVALID_PAYMENT_SIGNATURE');

    await expect(
      gateway.verifyIpn({
        signature: 'sandbox-merchant-secret',
        payload: {
          notification_type: 'TRANSACTION_VOID',
          order: {},
          timestamp: 1_757_058_220,
          transaction: {},
        },
      }),
    ).rejects.toThrow('INVALID_PAYMENT_PAYLOAD');
  });
});
