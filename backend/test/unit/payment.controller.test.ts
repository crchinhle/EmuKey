import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommerceService } from '../../src/modules/commerce-payment/application/commerce.service.js';
import { PaymentController } from '../../src/modules/commerce-payment/presentation/commerce.controller.js';
import { AuthGuard, RolesGuard } from '../../src/modules/identity-access/security.guards.js';

describe('PaymentController', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('passes the official SePay X-Secret-Key header to IPN verification', async () => {
    const ingestIpn = vi.fn().mockResolvedValue({
      classification: 'DUPLICATE',
      transactionId: '286c64be-fdcf-4940-8e78-f1a01482d613',
    });
    const module = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: CommerceService, useValue: { ingestIpn } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();

    const payload = { notification_type: 'ORDER_PAID' };
    await request(app.getHttpServer() as Server)
      .post('/payments/ipn')
      .set('X-Secret-Key', 'sandbox-ipn-secret')
      .send(payload)
      .expect(200);

    expect(ingestIpn).toHaveBeenCalledWith(payload, 'sandbox-ipn-secret');
  });
});
