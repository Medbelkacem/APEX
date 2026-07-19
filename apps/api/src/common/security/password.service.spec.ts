import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { PasswordService } from './password.service';

/** Cheap parameters — these tests are about behaviour, not work factor. */
const COSTS = { argon2MemoryCost: 1024, argon2TimeCost: 1, argon2Parallelism: 1 };

function serviceWith(costs: Partial<typeof COSTS> = {}): PasswordService {
  const config = {
    get: () => ({ ...COSTS, ...costs }),
  } as unknown as ConfigService;
  return new PasswordService(config);
}

describe('PasswordService', () => {
  const service = serviceWith();

  describe('hashing', () => {
    it('produces an Argon2id hash', async () => {
      const hash = await service.hash('TestPassw0rd!');

      expect(hash.startsWith('$argon2id$')).toBe(true);
    });

    it('salts, so the same password hashes differently every time', async () => {
      const [a, b] = await Promise.all([service.hash('same'), service.hash('same')]);

      expect(a).not.toBe(b);
      expect(await service.verify(a, 'same')).toBe(true);
      expect(await service.verify(b, 'same')).toBe(true);
    });
  });

  describe('verifying', () => {
    it('accepts the correct password', async () => {
      const hash = await service.hash('TestPassw0rd!');

      expect(await service.verify(hash, 'TestPassw0rd!')).toBe(true);
    });

    it('rejects the wrong password', async () => {
      const hash = await service.hash('TestPassw0rd!');

      expect(await service.verify(hash, 'WrongPassw0rd!')).toBe(false);
    });

    it('still accepts a password stored as a legacy bcrypt hash', async () => {
      // Accounts created before the migration; their plaintext is unrecoverable,
      // so these hashes have to keep working indefinitely.
      const legacy = await bcrypt.hash('TestPassw0rd!', 10);

      expect(await service.verify(legacy, 'TestPassw0rd!')).toBe(true);
      expect(await service.verify(legacy, 'WrongPassw0rd!')).toBe(false);
    });

    it('rejects rather than throws on a corrupt hash', async () => {
      // A damaged row must fail this one login, not 500 and thereby single the
      // account out as different from every other failed attempt.
      expect(await service.verify('not-a-hash', 'TestPassw0rd!')).toBe(false);
      expect(await service.verify('', 'TestPassw0rd!')).toBe(false);
      expect(await service.verify('$argon2id$truncated', 'TestPassw0rd!')).toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('flags a legacy bcrypt hash', async () => {
      const legacy = await bcrypt.hash('TestPassw0rd!', 10);

      expect(service.needsRehash(legacy)).toBe(true);
    });

    it('leaves a hash at the configured cost alone', async () => {
      const hash = await service.hash('TestPassw0rd!');

      expect(service.needsRehash(hash)).toBe(false);
    });

    it('flags a hash made before the cost was raised', async () => {
      const weak = await serviceWith({ argon2MemoryCost: 1024 }).hash('TestPassw0rd!');

      // Same hash, read by a service configured to hash harder than it did.
      expect(serviceWith({ argon2MemoryCost: 19_456 }).needsRehash(weak)).toBe(true);
    });

    it('does not flag a hash stronger than the configured cost', async () => {
      const strong = await serviceWith({ argon2MemoryCost: 8192 }).hash('TestPassw0rd!');

      // Lowering the setting must not downgrade accounts that already cost more.
      expect(serviceWith({ argon2MemoryCost: 1024 }).needsRehash(strong)).toBe(false);
    });

    it('flags a hash whose parameters cannot be read', () => {
      expect(service.needsRehash('$argon2id$v=19$mangled')).toBe(true);
    });
  });
});
