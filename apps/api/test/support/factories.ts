/**
 * Fixture builders.
 *
 * Every factory writes through the real repositories so that column defaults,
 * constraints, and the snake_case naming strategy all take effect — a fixture
 * inserted with raw SQL would happily violate rules the application relies on.
 *
 * Emails are suffixed with a per-process counter rather than a random value so
 * that a failing assertion names a stable address, and so two workers running
 * concurrently cannot collide on the unique index.
 */
import { DataSource } from 'typeorm';
import { hash as argon2Hash } from '@node-rs/argon2';
import { UserRole, UserStatus } from '@dental/shared-types';
import { authConfig } from '../../src/config/auth.config';
import { argon2OptionsFrom } from '../../src/common/security/password.service';
import { User } from '../../src/database/entities/user.entity';
import { Dentist } from '../../src/database/entities/dentist.entity';
import { CaseType } from '../../src/database/entities/case-type.entity';
import { CaseStatus } from '../../src/database/entities/case-status.entity';
import { PricingRule } from '../../src/database/entities/pricing-rule.entity';

/** Meets the policy in common/utils/password-policy.ts: 10+ chars, upper, lower, digit. */
export const TEST_PASSWORD = 'TestPassw0rd!';

let counter = 0;
const unique = (): string => `${process.pid}-${++counter}`;

export interface SeededDentist {
  user: User;
  dentist: Dentist;
}

export class Fixtures {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Hashing at the configured cost on every fixture would dominate the suite's
   * runtime, and the value is identical for every user, so it is computed once.
   */
  private passwordHash?: string;

  private async hash(): Promise<string> {
    if (!this.passwordHash) {
      this.passwordHash = await argon2Hash(TEST_PASSWORD, argon2OptionsFrom(authConfig()));
    }
    return this.passwordHash;
  }

  async user(overrides: Partial<User> = {}): Promise<User> {
    const repo = this.dataSource.getRepository(User);
    const entity = repo.create({
      email: `user-${unique()}@dental-lab.test`,
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.DENTIST,
      status: UserStatus.ACTIVE,
      passwordHash: await this.hash(),
      ...overrides,
    });
    return repo.save(entity);
  }

  admin(overrides: Partial<User> = {}): Promise<User> {
    return this.user({ role: UserRole.ADMIN, firstName: 'Ada', lastName: 'Admin', ...overrides });
  }

  superAdmin(overrides: Partial<User> = {}): Promise<User> {
    return this.user({
      role: UserRole.SUPER_ADMIN,
      firstName: 'Sam',
      lastName: 'Super',
      ...overrides,
    });
  }

  /** A dentist user plus the linked profile row the case/invoice scoping needs. */
  async dentist(
    userOverrides: Partial<User> = {},
    dentistOverrides: Partial<Dentist> = {},
  ): Promise<SeededDentist> {
    const user = await this.user({
      role: UserRole.DENTIST,
      firstName: 'Dana',
      lastName: 'Dentist',
      ...userOverrides,
    });
    const repo = this.dataSource.getRepository(Dentist);
    const dentist = await repo.save(
      repo.create({
        userId: user.id,
        clinicName: `Clinic ${unique()}`,
        ...dentistOverrides,
      }),
    );
    return { user, dentist };
  }

  async caseType(overrides: Partial<CaseType> = {}): Promise<CaseType> {
    const repo = this.dataSource.getRepository(CaseType);
    const id = unique();
    return repo.save(
      repo.create({
        name: `Crown ${id}`,
        slug: `crown-${id}`,
        isActive: true,
        sortOrder: 0,
        ...overrides,
      }),
    );
  }

  async caseStatus(overrides: Partial<CaseStatus> = {}): Promise<CaseStatus> {
    const repo = this.dataSource.getRepository(CaseStatus);
    const id = unique();
    return repo.save(
      repo.create({
        label: `Received ${id}`,
        slug: `received-${id}`,
        color: '#2563eb',
        sortOrder: 0,
        isTerminal: false,
        isActive: true,
        ...overrides,
      }),
    );
  }

  async pricingRule(caseTypeId: string, overrides: Partial<PricingRule> = {}): Promise<PricingRule> {
    const repo = this.dataSource.getRepository(PricingRule);
    return repo.save(
      repo.create({
        caseTypeId,
        price: '100.00',
        currency: 'USD',
        isActive: true,
        // Yesterday, so `effectiveFrom <= today` holds in every timezone.
        effectiveFrom: isoDate(-1),
        ...overrides,
      }),
    );
  }

  /**
   * The minimum catalog a case can be submitted against: an entry status
   * (lowest sortOrder, non-terminal — this is what `defaultStatus()` picks), a
   * terminal status for completion, one case type, and a price for it.
   */
  async catalog(): Promise<{
    caseType: CaseType;
    entryStatus: CaseStatus;
    terminalStatus: CaseStatus;
    pricingRule: PricingRule;
  }> {
    const entryStatus = await this.caseStatus({ sortOrder: 0, isTerminal: false });
    const terminalStatus = await this.caseStatus({
      label: 'Completed',
      slug: `completed-${unique()}`,
      sortOrder: 100,
      isTerminal: true,
    });
    const caseType = await this.caseType();
    const pricingRule = await this.pricingRule(caseType.id);
    return { caseType, entryStatus, terminalStatus, pricingRule };
  }
}

/** `YYYY-MM-DD`, offset from today in whole days. Matches the `date` columns. */
export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
