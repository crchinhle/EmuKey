import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Address, Hex } from 'viem';

import {
  activationCommitment,
  canonicalizeEntitlements,
  planCommitment,
  uuidToBytes16,
} from '../../../src/platform/crypto/license-crypto.js';

describe('license cryptographic protocol V2', () => {
  const vector = JSON.parse(
    readFileSync(resolve(process.cwd(), 'contracts/test-vectors/crypto-v2.json'), 'utf8'),
  ) as {
    entitlements: { hash: Hex; jcs: string; value: Record<string, unknown> };
    plan: { commitment: Hex; durationMonths: number; maxActiveDevices: number; planId: string; planVersion: number; productId: string; providerChainAddress: Address };
    activation: { commitment: Hex; secret: Hex };
  };

  it('uses RFC 8785 JCS ordering and rejects unsupported values', () => {
    expect(canonicalizeEntitlements({ z: 1, a: { y: true, x: 'ok' } })).toBe('{"a":{"x":"ok","y":true},"z":1}');
    expect(() => canonicalizeEntitlements({ invalid: Number.NaN })).toThrow('Unsupported entitlement value');
    expect(() => canonicalizeEntitlements({ invalid: undefined })).toThrow('Unsupported entitlement value');
  });

  it('matches the frozen V2 vector and excludes Service Terms', () => {
    expect(canonicalizeEntitlements(vector.entitlements.value)).toBe(vector.entitlements.jcs);
    const input = { ...vector.plan, entitlements: vector.entitlements.value };
    expect(planCommitment(input)).toBe(vector.plan.commitment);
    expect(planCommitment(input)).toBe(planCommitment({ ...input }));
    expect(planCommitment({ ...input, entitlements: { ...vector.entitlements.value, service: false } })).not.toBe(vector.plan.commitment);
    expect(uuidToBytes16(input.planId)).toHaveLength(34);
    expect(() => uuidToBytes16('not-a-uuid')).toThrow('Invalid UUID');
  });

  it('keeps activation commitment deterministic', () => {
    expect(activationCommitment(vector.activation.secret)).toBe(vector.activation.commitment);
  });
});
