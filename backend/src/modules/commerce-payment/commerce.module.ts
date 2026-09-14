import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { AuditWriter } from '../../platform/audit/audit-writer.js';
import { TermsLoader } from '../../platform/terms/terms-loader.js';
import {
  ACTIVATION_ENVELOPE,
  type ActivationEnvelopePort,
} from '../blockchain/application/ports/activation-envelope.port.js';
import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { ActivationEnvelopeRecoveryService } from '../blockchain/application/activation-envelope-recovery.service.js';
import { IdentityModule } from '../identity-access/identity.module.js';
import { CommerceService } from './application/commerce.service.js';
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
} from './application/ports/payment-gateway.port.js';
import {
  CommerceRepository,
  type ChainConfiguration,
} from './infrastructure/commerce.repository.js';
import { FakePaymentGateway } from './infrastructure/fake-payment.gateway.js';
import { SePayPaymentGateway } from './infrastructure/sepay-payment.gateway.js';
import {
  CommerceController,
  PaymentController,
} from './presentation/commerce.controller.js';

const CHAIN_CONFIGURATION = Symbol('CHAIN_CONFIGURATION');

@Module({
  imports: [IdentityModule, BlockchainModule],
  controllers: [CommerceController, PaymentController],
  providers: [
    {
      provide: CommerceRepository,
      inject: [Pool, AuditWriter],
      useFactory: (pool: Pool, audit: AuditWriter) =>
        new CommerceRepository(pool, audit),
    },
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PaymentGatewayPort => {
        const adapter = config.getOrThrow<string>('PAYMENT_ADAPTER');
        if (adapter === 'fake') {
          return new FakePaymentGateway(
            config.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET'),
          );
        }
        if (adapter === 'sepay') {
          return new SePayPaymentGateway({
            environment: config.getOrThrow<'production' | 'sandbox'>('SEPAY_ENV'),
            merchantId: config.getOrThrow<string>('SEPAY_MERCHANT_ID'),
            secretKey: config.getOrThrow<string>('SEPAY_SECRET_KEY'),
            webAppUrl: config.getOrThrow<string>('WEB_APP_URL'),
          });
        }
        throw new Error(`Payment adapter ${adapter} is not configured`);
      },
    },
    {
      provide: CHAIN_CONFIGURATION,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ChainConfiguration => ({
        chainId: config.getOrThrow<number>('EVM_CHAIN_ID'),
        contractAddress: config.getOrThrow<string>('EVM_CONTRACT_ADDRESS'),
        network: config.getOrThrow<string>('EVM_NETWORK'),
      }),
    },
    {
      provide: CommerceService,
      inject: [
        CommerceRepository,
        PAYMENT_GATEWAY,
        ACTIVATION_ENVELOPE,
        ActivationEnvelopeRecoveryService,
        CHAIN_CONFIGURATION,
        TermsLoader,
      ],
      useFactory: (
        repository: CommerceRepository,
        payment: PaymentGatewayPort,
        envelopes: ActivationEnvelopePort,
        recovery: ActivationEnvelopeRecoveryService,
        chain: ChainConfiguration,
        terms: TermsLoader,
      ) =>
        new CommerceService(
          repository,
          payment,
          envelopes,
          recovery,
          chain,
          terms,
        ),
    },
  ],
  exports: [CommerceService],
})
export class CommerceModule {}
