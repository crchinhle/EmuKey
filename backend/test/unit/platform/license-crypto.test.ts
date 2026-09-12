import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Address, Hex } from 'viem';

import {
  activationCommitment,
  canonicalizeEntitlements,
  normalizeTerms,
  planCommitment,
  termsHash,
  uuidToBytes16,
} from '../../../src/platform/crypto/license-crypto.js';

interface CryptoVector {
  activation: { commitment: Hex; secret: Hex };
  entitlements: {
    hash: Hex;
    jcs: string;
    value: Record<string, unknown>;
  };
  plan: {
    commitment: Hex;
    durationMonths: number;
    maxActiveDevices: number;
    planId: string;
    planVersion: number;
    productId: string;
    providerChainAddress: Address;
  };
  terms: { hash: Hex; normalized: string };
}

describe('license cryptographic protocol', () => {
  const vector = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'contracts/test-vectors/crypto-v1.json'),
      'utf8',
    ),
  ) as unknown as CryptoVector;

  it('normalizes line endings and final newlines before hashing Terms', () => {
    const canonical = '# Terms\n\nĐiều khoản thử nghiệm.\n';
    expect(normalizeTerms('# Terms\r\n\r\nĐiều khoản thử nghiệm.')).toBe(
      canonical,
    );
    expect(normalizeTerms(`${canonical}\n\n`)).toBe(canonical);
    expect(termsHash(canonical)).toBe(
      termsHash('# Terms\r\n\r\nĐiều khoản thử nghiệm.'),
    );
  });

  it('uses RFC 8785 JCS ordering and rejects unsupported values', () => {
    expect(canonicalizeEntitlements({ z: 1, a: { y: true, x: 'ok' } })).toBe(
      '{"a":{"x":"ok","y":true},"z":1}',
    );
    expect(() => canonicalizeEntitlements({ invalid: Number.NaN })).toThrow(
      'Unsupported entitlement value',
    );
    expect(() => canonicalizeEntitlements({ invalid: undefined })).toThrow(
      'Unsupported entitlement value',
    );
  });

  it('validates fixed-width inputs and returns deterministic commitments', () => {
    const input = {
      durationMonths: 12,
      entitlements: { desktop: true },
      maxActiveDevices: 3,
      planId: '00000000-0000-4000-8000-000000000302',
      planVersion: 1,
      productId: '00000000-0000-4000-8000-000000000200',
      providerChainAddress: '0x0000000000000000000000000000000000000002',
      termsHash: termsHash('Terms v1'),
    } as const;

    expect(uuidToBytes16(input.planId)).toHaveLength(34);
    expect(planCommitment(input)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(planCommitment(input)).toBe(planCommitment(input));
    expect(
      activationCommitment(
        '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      ),
    ).toMatch(/^0x[0-9a-f]{64}$/);
    expect(() => uuidToBytes16('not-a-uuid')).toThrow('Invalid UUID');
  });

  it('matches the frozen cross-runtime vector byte for byte', () => {
    expect(termsHash(vector.terms.normalized)).toBe(vector.terms.hash);
    expect(canonicalizeEntitlements(vector.entitlements.value)).toBe(
      vector.entitlements.jcs,
    );
    expect(
      planCommitment({
        ...vector.plan,
        entitlements: vector.entitlements.value,
        termsHash: vector.terms.hash,
      }),
    ).toBe(vector.plan.commitment);
    expect(activationCommitment(vector.activation.secret)).toBe(
      vector.activation.commitment,
    );
  });
});
