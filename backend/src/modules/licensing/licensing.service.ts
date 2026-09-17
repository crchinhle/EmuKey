import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { recoverMessageAddress, type Hex } from 'viem';
import { jwtVerify, SignJWT } from 'jose';
import type { Redis } from 'ioredis';

import { activationCommitment } from '../../platform/crypto/license-crypto.js';
import type { AuthPrincipal } from '../identity-access/identity.types.js';
import type { IdentityService } from '../identity-access/identity.service.js';
import type { ActivationEnvelopePort } from '../blockchain/application/ports/activation-envelope.port.js';
import type { LicenseProjectionRepository } from '../blockchain/infrastructure/license-projection.repository.js';
import type {
  LicenseCommandConfig,
  LicensingRepository,
} from './infrastructure/licensing.repository.js';
import type {
  ActivateDeviceDto,
  LicenseLifecycleDto,
  RevokeDeviceDto,
  RotateActivationKeyDto,
  LicensingActionVerificationDto,
} from './licensing.dto.js';

const CHALLENGE_TTL = 300;
const ENTITLEMENT_TTL_SECONDS = 300;
const ENTITLEMENT_AUDIENCE = 'emukey-license-client';
const ENTITLEMENT_ISSUER = 'emukey-licensing';

export class LicensingService {
  constructor(
    private readonly repository: LicensingRepository,
    private readonly projection: LicenseProjectionRepository,
    private readonly envelopes: ActivationEnvelopePort,
    private readonly redis: Redis,
    private readonly jwtSecret: Uint8Array,
    private readonly chain: LicenseCommandConfig,
    private readonly identity?: IdentityService,
  ) {}

  async requestActionVerification(actor: AuthPrincipal, dto: LicensingActionVerificationDto) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(dto.licenseId);
    if (!license) this.notFound();
    if (!this.identity) throw new Error('IDENTITY_SERVICE_UNAVAILABLE');
    await this.identity.issueLicensingActionVerification(actor.sub, dto.licenseId, dto.action);
    return { accepted: true };
  }

  async commandStatus(actor: AuthPrincipal, commandId: string) {
    const result = await this.repository.commandStatus(actor.sub, commandId);
    if (!result) this.notFound();
    return result;
  }

  async challenge(actor: AuthPrincipal, licenseId: string, deviceRef: string, deviceId?: string) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(licenseId);
    if (!license) this.notFound();
    this.requireActive(license.status, license.expiresAt);
    const device = deviceId ? await this.repository.findDeviceById(licenseId, deviceId) : null;
    if (deviceId && !device) this.notFound();
    const opaqueDeviceRef = device?.deviceRef ?? this.opaqueDeviceRef(deviceRef);
    const challenge = `emukey:${licenseId}:${opaqueDeviceRef}:${randomBytes(24).toString('base64url')}`;
    const key = this.challengeKey(licenseId, opaqueDeviceRef);
    await this.redis.set(key, challenge, 'EX', CHALLENGE_TTL);
    return { challenge, expiresAt: new Date(Date.now() + CHALLENGE_TTL * 1_000).toISOString() };
  }

  async activate(actor: AuthPrincipal, dto: ActivateDeviceDto) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(dto.licenseId);
    if (!license) this.notFound();
    this.requireActive(license.status, license.expiresAt);
    this.verifyBearerKey(dto.activationKey, license.activationCommitment);
    const opaqueDeviceRef = this.opaqueDeviceRef(dto.deviceRef);
    await this.verifyDeviceProof(dto.licenseId, opaqueDeviceRef, dto.challenge, dto.proof, dto.devicePublicKey);
    const deviceId = randomUUID();
    try {
      return await this.repository.createDeviceCommand(actor.sub, dto.licenseId, opaqueDeviceRef, dto.devicePublicKey, deviceId, this.chain);
    } catch (error) {
      this.translate(error);
    }
  }

  async revokeDevice(actor: AuthPrincipal, licenseId: string, deviceId: string, dto: RevokeDeviceDto) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(licenseId);
    const device = await this.repository.findDeviceById(licenseId, deviceId);
    if (!license || !device) this.notFound();
    this.verifyBearerKey(dto.activationKey, license.activationCommitment);
    await this.verifyDeviceProof(licenseId, device.deviceRef, dto.challenge, dto.proof, device.devicePublicKey);
    await this.consumeActionToken(actor, dto.actionToken, licenseId, 'REVOKE_DEVICE');
    const chainDeviceId = `0x${createHash('sha256').update(device.deviceRef).digest('hex')}`;
    try {
      return await this.repository.createDeviceRevokeCommand(actor.sub, licenseId, device.deviceRef, chainDeviceId, this.chain);
    } catch (error) {
      this.translate(error);
    }
  }

  async rotate(actor: AuthPrincipal, licenseId: string, dto: RotateActivationKeyDto) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(licenseId);
    if (!license) this.notFound();
    this.requireActive(license.status, license.expiresAt);
    this.verifyBearerKey(dto.currentKey, license.activationCommitment);
    await this.consumeActionToken(actor, dto.actionToken, licenseId, 'ROTATE_KEY');
    const secret: `0x${string}` = `0x${randomBytes(32).toString('hex')}`;
    const commitment = activationCommitment(secret);
    const command = await this.repository.createRotationCommand(actor.sub, licenseId, commitment, license.activationKeyVersion + 1, this.chain);
    if (!command.reused) {
      await this.envelopes.prepare({
        commandId: command.commandId,
        commitment,
        keyVersion: license.activationKeyVersion + 1,
        licenseId,
        secret,
      }, 86_400);
    }
    return {
      commandId: command.commandId,
      deviceId: command.deviceId,
      licenseId: command.licenseId,
      status: command.status,
    };
  }

  async lifecycle(actor: AuthPrincipal, licenseId: string, dto: LicenseLifecycleDto) {
    if (actor.role !== 'PROVIDER_ADMIN') throw new ForbiddenException();
    try {
      return await this.repository.createLifecycleCommand(actor.sub, licenseId, dto.command, this.chain, dto.reason);
    } catch (error) {
      this.translate(error);
    }
  }

  async issueEntitlement(actor: AuthPrincipal, dto: import('./licensing.dto.js').EntitlementRefreshDto) {
    this.requireCustomer(actor);
    return this.signEntitlement(actor.sub, dto);
  }

  async refreshEntitlement(actor: AuthPrincipal, dto: import('./licensing.dto.js').EntitlementRefreshDto) {
    this.requireCustomer(actor);
    return this.signEntitlement(actor.sub, dto);
  }

  async verifyEntitlement(
    actor: AuthPrincipal,
    dto: import('./licensing.dto.js').EntitlementVerifyDto,
  ) {
    this.requireCustomer(actor);
    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(dto.token, this.jwtSecret, {
        algorithms: ['HS256'],
        audience: ENTITLEMENT_AUDIENCE,
        issuer: ENTITLEMENT_ISSUER,
      }));
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_ENTITLEMENT',
        message: 'The entitlement token is invalid or expired.',
      });
    }
    const { deviceId, entitlementVersion, exp, keyVersion, licenseId, rights } = payload;
    if (
      typeof deviceId !== 'string' ||
      typeof entitlementVersion !== 'number' ||
      typeof exp !== 'number' ||
      typeof keyVersion !== 'number' ||
      typeof licenseId !== 'string' ||
      typeof rights !== 'object' ||
      rights === null ||
      Array.isArray(rights)
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_ENTITLEMENT',
        message: 'The entitlement token has an invalid payload.',
      });
    }
    const context = await this.projection.entitlementContext(
      actor.sub,
      licenseId,
      deviceId,
    );
    if (
      !context ||
      context.status !== 'ACTIVE' ||
      context.deviceStatus !== 'ACTIVE' ||
      context.finality !== 'CONFIRMED' ||
      context.licenseFinality !== 'CONFIRMED' ||
      context.expiresAt.getTime() <= Date.now() ||
      context.entitlementVersion !== entitlementVersion ||
      context.keyVersion !== keyVersion
    ) {
      throw new ConflictException({
        code: 'ENTITLEMENT_INVALIDATED',
        message: 'The entitlement was invalidated by the current on-chain license state.',
      });
    }
    return {
      deviceId,
      entitlementVersion,
      expiresAt: new Date(exp * 1_000).toISOString(),
      keyVersion,
      licenseId,
      rights: rights as Record<string, unknown>,
      valid: true as const,
    };
  }

  private async signEntitlement(customerUserId: string, dto: import('./licensing.dto.js').EntitlementRefreshDto) {
    const { licenseId, deviceId } = dto;
    const context = await this.projection.entitlementContext(customerUserId, licenseId, deviceId);
    if (!context) this.notFound();
    if (context.status !== 'ACTIVE' || context.deviceStatus !== 'ACTIVE' || context.finality !== 'CONFIRMED' || context.licenseFinality !== 'CONFIRMED' || context.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException({ code: 'ENTITLEMENT_NOT_AVAILABLE', message: 'License and device must be chain-confirmed and active.' });
    }
    const device = await this.repository.findDeviceById(licenseId, deviceId);
    if (!device) this.notFound();
    await this.verifyDeviceProof(licenseId, device.deviceRef, dto.challenge, dto.proof, device.devicePublicKey);
    const expiresAt = new Date(Math.min(context.expiresAt.getTime(), Date.now() + ENTITLEMENT_TTL_SECONDS * 1_000));
    const token = await new SignJWT({
      deviceId,
      entitlementVersion: context.entitlementVersion,
      keyVersion: context.keyVersion,
      licenseId,
      rights: context.entitlements,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience(ENTITLEMENT_AUDIENCE)
      .setIssuer(ENTITLEMENT_ISSUER)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1_000))
      .sign(this.jwtSecret);
    return { token, expiresAt: expiresAt.toISOString(), licenseId, deviceId, entitlementVersion: context.entitlementVersion };
  }

  private verifyBearerKey(value: string, expected: Hex) {
    try {
      if (activationCommitment(value as `0x${string}`) !== expected) {
        throw new Error('INVALID_LICENSE_KEY');
      }
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_LICENSE_KEY', message: 'The activation key is invalid.' });
    }
  }

  private async verifyDeviceProof(licenseId: string, deviceRef: string, challenge: string, proof: string, expectedAddress: string) {
    const key = this.challengeKey(licenseId, deviceRef);
    const stored = await this.redis.get(key);
    if (!stored || stored !== challenge) throw new UnauthorizedException({ code: 'INVALID_DEVICE_CHALLENGE', message: 'The device challenge is invalid or expired.' });
    const recovered = await recoverMessageAddress({ message: challenge, signature: proof as `0x${string}` });
    if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) throw new UnauthorizedException({ code: 'INVALID_DEVICE_PROOF', message: 'The device proof is invalid.' });
    const consumed = await this.redis.eval(
      "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('DEL',KEYS[1]); return 1; end; return 0",
      1,
      key,
      challenge,
    );
    if (Number(consumed) !== 1) throw new UnauthorizedException({ code: 'INVALID_DEVICE_CHALLENGE', message: 'The device challenge is invalid or expired.' });
  }

  private async consumeActionToken(actor: AuthPrincipal, token: string, licenseId: string, action: string) {
    if (!this.identity) throw new Error('IDENTITY_SERVICE_UNAVAILABLE');
    await this.identity.consumeLicensingActionVerification(token, actor.sub, licenseId, action);
  }

  private opaqueDeviceRef(deviceRef: string): string {
    return createHmac('sha256', this.jwtSecret).update(`device-ref:${deviceRef}`).digest('hex');
  }

  private challengeKey(licenseId: string, deviceRef: string) {
    return `nonce:activation:${licenseId}:${createHash('sha256').update(deviceRef).digest('hex')}`;
  }

  private requireCustomer(actor: AuthPrincipal) {
    if (actor.role !== 'CUSTOMER') throw new ForbiddenException();
  }

  private requireActive(status: string, expiresAt: Date) {
    if (status !== 'ACTIVE' || expiresAt.getTime() <= Date.now()) throw new ConflictException({ code: 'LICENSE_NOT_ACTIVE', message: 'The license is not active.' });
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'LICENSE_NOT_FOUND', message: 'License was not found.' });
  }

  private translate(error: unknown): never {
    const code = error instanceof Error ? error.message : 'LICENSING_OPERATION_FAILED';
    if (['LICENSE_NOT_FOUND', 'LICENSE_NOT_CUSTOMER_OWNED', 'LICENSE_NOT_PROVIDER_OWNED', 'DEVICE_NOT_FOUND'].includes(code)) this.notFound();
    if (['DEVICE_ALREADY_ACTIVE', 'DEVICE_NOT_ACTIVE', 'DEVICE_QUOTA_EXCEEDED', 'LICENSE_NOT_ACTIVE', 'LICENSE_STATE_INVALID', 'INVALID_KEY_VERSION'].includes(code)) throw new ConflictException({ code, message: 'The requested licensing transition is not allowed.' });
    throw error;
  }
}
