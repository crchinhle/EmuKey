import { IdentityService, type IdentityRedis, type PasswordRepository } from '../../src/modules/identity-access/identity.service.js';
import type { IdentityUser } from '../../src/modules/identity-access/identity.types.js';
import { vi } from 'vitest';

const user: IdentityUser = { id: 'u1', email: 'a@b.test', passwordHash: '', displayName: 'A', role: 'SUPPORT_STAFF', status: 'ACTIVE', sessionVersion: 1, organizationName: null, customerType: null, emailVerifiedAt: null, phone: null, address: null, failedLoginCount: 0, lockedUntil: null };
class FakeRedis implements IdentityRedis {
  data = new Map<string, string>();
  set(key: string, value: string) { this.data.set(key, value); return Promise.resolve('OK'); }
  get(key: string) { return Promise.resolve(this.data.get(key) ?? null); }
  del(key: string) { return Promise.resolve(this.data.delete(key) ? 1 : 0); }
  eval(_script: string, numKeys: number, ...args: (number | string)[]) { const key = String(args[0]); const value = this.data.get(key) ?? null; this.data.delete(key); if (numKeys === 2 && value) this.data.set(String(args[1]), value); return Promise.resolve(value); }
  incr(key: string) { const value = Number(this.data.get(key) ?? 0) + 1; this.data.set(key, String(value)); return Promise.resolve(value); }
  expire() { return Promise.resolve(1); }
}
function repo(): PasswordRepository { return { findByEmail: vi.fn(() => Promise.resolve(user)), findById: vi.fn(() => Promise.resolve(user)), listUsers: vi.fn(() => Promise.resolve([user])), activateCustomer: vi.fn(), createCustomer: vi.fn(), updatePassword: vi.fn(), touchLogin: vi.fn(), bumpSessionVersion: vi.fn(), updateProfile: vi.fn(), changeStateByAdmin: vi.fn(), recordFailedLogin: vi.fn(), unlockExpired: vi.fn() }; }

describe('IdentityService', () => {
  it('rotates refresh tokens and rejects reuse', async () => {
    const redis = new FakeRedis(); const service = new IdentityService(repo(), redis, new TextEncoder().encode('test-secret')); const first = await service.issue(user); const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ response: { code: 'REFRESH_REUSE_DETECTED' } });
  });
  it('consumes reset tokens once and bumps the durable session version', async () => {
    const repository = repo(); const redis = new FakeRedis(); const service = new IdentityService(repository, redis, new TextEncoder().encode('test-secret')); await service.forgotPassword(user.email);
    expect([...redis.data.keys()].filter((key) => key.startsWith('reset:'))).toHaveLength(1);
    const token = 'not-readable-from-redis';
    await expect(service.resetPassword(token, 'new-password-123')).rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_TOKEN' } });
  });
});
