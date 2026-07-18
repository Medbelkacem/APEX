import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The laboratory bills in Algerian dinar, so DZD — not USD — is the platform
 * default. Only the column defaults move here: rows already carrying an
 * explicit currency are left untouched, because rewriting a recorded currency
 * would silently restate historical money.
 */
export class CurrencyDefaultDzd1784500000000 implements MigrationInterface {
  name = 'CurrencyDefaultDzd1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'DZD'`);
    await queryRunner.query(`ALTER TABLE "pricing_rules" ALTER COLUMN "currency" SET DEFAULT 'DZD'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pricing_rules" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
  }
}
