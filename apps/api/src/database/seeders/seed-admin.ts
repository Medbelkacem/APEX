import { DataSource } from 'typeorm';
import { hash as argon2Hash } from '@node-rs/argon2';
import { UserRole, UserStatus } from '@dental/shared-types';
import { User } from '../entities';
import { authConfig } from '../../config/auth.config';
import { argon2OptionsFrom } from '../../common/security/password.service';

/** Create the first super-admin from env, if it does not already exist. */
export async function seedAdmin(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(User);
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@dental-lab.test').toLowerCase();

  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`  • super-admin already exists (${email})`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await argon2Hash(password, argon2OptionsFrom(authConfig()));

  const admin = repo.create({
    email,
    passwordHash,
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    firstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'Platform',
    lastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Admin',
  });
  await repo.save(admin);

  // eslint-disable-next-line no-console
  console.log(`  ✓ super-admin created: ${email} / ${password}`);
}
