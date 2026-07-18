import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reverts the DZD default introduced by CurrencyDefaultDzd1784500000000: the
 * platform bills in USD.
 *
 * Forward-only rather than reverting the earlier migration, so any environment
 * that already ran it converges on the same schema. As before, only the column
 * defaults move — rows carrying an explicit currency are left alone, since
 * rewriting a recorded currency would silently restate historical money.
 */
export class CurrencyDefaultUsd1784600000000 implements MigrationInterface {
  name = 'CurrencyDefaultUsd1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
    await queryRunner.query(`ALTER TABLE "pricing_rules" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pricing_rules" ALTER COLUMN "currency" SET DEFAULT 'DZD'`);
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'DZD'`);
  }
}
