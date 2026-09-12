import { randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { keccak256, stringToHex, type Hex } from 'viem';

import type { ActivationEnvelopePort } from '../../blockchain/application/ports/activation-envelope.port.js';
import type { ActivationEnvelopeRecoveryService } from '../../blockchain/application/activation-envelope-recovery.service.js';
import {
  activationCommitment,
  canonicalizeEntitlements,
} from '../../../platform/crypto/license-crypto.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type {
  AcceptTermsDto,
  CreateOrderDto,
} from '../presentation/commerce.dto.js';
import type { PaymentGatewayPort } from './ports/payment-gateway.port.js';
import { TermsLoader } from '../../../platform/terms/terms-loader.js';
import {
  CommerceRepository,
  type ChainConfiguration,
  type IssuanceMaterial,
} from '../infrastructure/commerce.repository.js';

const ACTIVATION_ENVELOPE_TTL = 86_400;

@Injectable()
export class CommerceService {
  constructor(
    private readonly repository: CommerceRepository,
    private readonly payment: PaymentGatewayPort,
    private readonly envelopes: ActivationEnvelopePort,
    private readonly envelopeRecovery: ActivationEnvelopeRecoveryService,
    private readonly chain: ChainConfiguration,
    private readonly terms = new TermsLoader(),
  ) {}

  async createOrder(
    actor: AuthPrincipal,
    idempotencyKey: string | undefined,
    licenseKey: string | undefined,
    dto: CreateOrderDto,
  ) {
    this.requireCustomer(actor);
    if (
      !idempotencyKey ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)
    ) {
      throw new BadRequestException({
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key must be a UUID.',
      });
    }
    const targetCommitment = dto.targetLicenseId
      ? this.licenseCommitment(licenseKey)
      : undefined;
    try {
      return await this.repository.createOrder(
        actor.sub,
        idempotencyKey,
        dto.planId,
        dto.targetLicenseId,
        targetCommitment,
      );
    } catch (error) {
      this.translate(error);
      throw error;
    }
  }

  listOrders(actor: AuthPrincipal) {
    this.requireCustomer(actor);
    return this.repository.listCustomerOrders(actor.sub);
  }

  async findOrder(actor: AuthPrincipal, id: string) {
    this.requireCustomer(actor);
    const order = await this.repository.findOrder(actor.sub, id);
    if (!order) this.notFound();
    return order;
  }

  async getOrderTerms(actor: AuthPrincipal, id: string) {
    this.requireCustomer(actor);
    const order = await this.repository.findOrder(actor.sub, id);
    if (!order) this.notFound();
    try {
      const terms = await this.terms.load(order.termsVersionSnapshot);
      if (terms.hash.toLowerCase() !== order.termsHashSnapshot.toLowerCase()) {
        throw new Error('TERMS_ARTEFACT_MISMATCH');
      }
      return terms;
    } catch {
      throw new ServiceUnavailableException({
        code: 'TERMS_ARTEFACT_UNAVAILABLE',
        message: 'The exact Terms snapshot is temporarily unavailable.',
      });
    }
  }

  async acceptTerms(actor: AuthPrincipal, id: string, dto: AcceptTermsDto) {
    this.requireCustomer(actor);
    try {
      return await this.repository.acceptTerms(
        actor.sub,
        id,
        dto.termsVersion,
        dto.termsHash,
      );
    } catch (error) {
      this.translate(error);
      throw error;
    }
  }

  async cancelOrder(actor: AuthPrincipal, id: string) {
    this.requireCustomer(actor);
    try {
      return await this.repository.cancelOrder(actor.sub, id);
    } catch (error) {
      this.translate(error);
      throw error;
    }
  }

  async checkout(actor: AuthPrincipal, id: string) {
    this.requireCustomer(actor);
    const order = await this.repository.findOrder(actor.sub, id);
    if (!order) this.notFound();
    let preparation;
    try {
      preparation = await this.repository.prepareCheckout(actor.sub, id);
    } catch (error) {
      this.translate(error);
      throw error;
    }
    try {
      const checkout = await this.payment.createCheckout({
        amountVnd: preparation.amountVnd,
        attemptId: preparation.attemptId,
      });
      await this.repository.completeCheckout(
        preparation.attemptId,
        checkout.checkoutReference,
      );
      return {
        ...checkout,
        amountVnd: preparation.amountVnd,
        attemptId: preparation.attemptId,
        expiresAt: preparation.expiresAt.toISOString(),
        expiresWithOrder: true,
      };
    } catch (error) {
      if (!preparation.existing) {
        await this.repository.failCheckout(preparation.attemptId);
      }
      throw error;
    }
  }

  async ingestIpn(payload: unknown, signature?: string) {
    let event;
    try {
      event = await this.payment.verifyIpn({
        payload,
        ...(signature === undefined ? {} : { signature }),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'INVALID_PAYMENT_SIGNATURE'
      ) {
        throw new UnauthorizedException({
          code: 'INVALID_PAYMENT_SIGNATURE',
          message: 'Payment signature is invalid.',
        });
      }
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_PAYLOAD',
        message: 'Payment payload is invalid.',
      });
    }

    const activation = this.newActivation(1);
    const result = await this.repository.ingestPayment(
      event,
      payload,
      activation.material,
      this.chain,
    );
    if (
      result.classification === 'MATCHED' &&
      result.activationRequired &&
      result.commandId &&
      result.licenseId
    ) {
      try {
        await this.envelopes.prepare(
          {
            commandId: result.commandId,
            commitment: activation.material.activationCommitment,
            keyVersion: 1,
            licenseId: result.licenseId,
            secret: activation.secret,
          },
          ACTIVATION_ENVELOPE_TTL,
        );
      } catch {
        await this.envelopeRecovery.recoverById(
          result.commandId,
          result.licenseId,
        );
      }
    }
    return result;
  }

  listPaymentHistory(actor: AuthPrincipal) {
    this.requirePaymentEvidenceRole(actor);
    return this.repository.listPaymentHistory(actor);
  }

  async getPaymentReceipt(actor: AuthPrincipal, id: string) {
    this.requirePaymentEvidenceRole(actor);
    const receipt = await this.repository.getPaymentReceipt(actor, id);
    if (!receipt) {
      throw new NotFoundException({
        code: 'PAYMENT_RECEIPT_NOT_FOUND',
        message: 'Payment receipt was not found.',
      });
    }
    return receipt;
  }

  async listPaymentReview(actor: AuthPrincipal) {
    this.requireReviewRole(actor);
    return this.repository.listPaymentReview();
  }

  async reviewPayment(
    actor: AuthPrincipal,
    id: string,
    status: 'CLOSED_NO_ACTION' | 'RESOLVED',
    reason: string,
  ) {
    this.requireReviewRole(actor);
    try {
      return await this.repository.reviewPayment(actor, id, status, reason);
    } catch (error) {
      this.translate(error);
      throw error;
    }
  }

  private newActivation(
    keyVersion: number,
    commandId: string = randomUUID(),
    licenseId: string = randomUUID(),
  ): { material: IssuanceMaterial; secret: Hex } {
    const secret: Hex = `0x${randomBytes(32).toString('hex')}`;
    const commitment = activationCommitment(secret);
    const payload = {
      activationCommitment: commitment,
      commandId,
      keyVersion,
      licenseId,
      protocolVersion: 1,
    };
    const payloadHash = keccak256(
      stringToHex(canonicalizeEntitlements(payload)),
    );
    return {
      material: {
        activationCommitment: commitment,
        commandId,
        licenseId,
        payload,
        payloadHash,
      },
      secret,
    };
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'ORDER_NOT_FOUND',
      message: 'Order was not found.',
    });
  }

  private requirePaymentEvidenceRole(actor: AuthPrincipal): void {
    if (!['CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF'].includes(actor.role)) {
      this.forbidden();
    }
  }

  private licenseCommitment(key: string | undefined): Hex {
    if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
      throw new UnauthorizedException({
        code: 'INVALID_LICENSE_KEY',
        message: 'A valid X-License-Key header is required for renewal.',
      });
    }
    return activationCommitment(key as Hex);
  }

  private requireReviewRole(actor: AuthPrincipal): void {
    if (!['SYSTEM_ADMIN', 'SUPPORT_STAFF'].includes(actor.role)) {
      this.forbidden();
    }
  }

  private requireCustomer(actor: AuthPrincipal): void {
    if (actor.role !== 'CUSTOMER') this.forbidden();
  }

  private forbidden(): never {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Payment evidence access is not allowed for this role.',
    });
  }

  private translate(error: unknown): void {
    const code = error instanceof Error ? error.message : '';
    if (
      code === 'PLAN_NOT_FOUND' ||
      code === 'RENEWAL_LICENSE_NOT_FOUND' ||
      code === 'ORDER_NOT_FOUND' ||
      code === 'PAYMENT_REVIEW_NOT_FOUND'
    ) {
      this.notFound();
    }
    if (code === 'IDEMPOTENCY_CONFLICT') {
      throw new ConflictException({
        code,
        message: 'Idempotency key was already used with another request.',
      });
    }
    if (
      code === 'ORDER_TERMS_MISMATCH' ||
      code === 'ORDER_NOT_CANCELLABLE' ||
      code === 'ORDER_NOT_WAITING_PAYMENT' ||
      code === 'ORDER_PAYMENT_EXPIRED'
    ) {
      throw new ConflictException({
        code,
        message: 'Order state does not allow this operation.',
      });
    }
  }
}
