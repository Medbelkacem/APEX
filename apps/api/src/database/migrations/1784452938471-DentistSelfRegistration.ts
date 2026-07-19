import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dentist self-registration: a `pending` user status and email-verification
 * columns.
 *
 * Existing rows are untouched. `email_verified_at` lands null on every account
 * that predates it, which asserts nothing either way — only `pending` accounts
 * are gated on that column, and no existing account is pending.
 *
 * The status enum is rebuilt rather than extended with ALTER TYPE ... ADD VALUE
 * because that statement cannot run inside a transaction block on older
 * PostgreSQL, and TypeORM wraps migrations in one. Rebuilding keeps the whole
 * migration atomic.
 */
export class DentistSelfRegistration1784452938471 implements MigrationInterface {
  name = 'DentistSelfRegistration1784452938471';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verification_token_hash" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verification_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."users_status_enum" RENAME TO "users_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'disabled', 'invited', 'pending')`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum" USING "status"::"text"::"public"."users_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum_old" AS ENUM('active', 'disabled', 'invited')`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum_old" USING "status"::"text"::"public"."users_status_enum_old"`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."users_status_enum_old" RENAME TO "users_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verification_expires_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verification_token_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified_at"`);
  }
}
