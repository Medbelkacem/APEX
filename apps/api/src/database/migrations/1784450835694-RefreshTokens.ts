import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Server-side session storage for refresh tokens.
 *
 * Only the SHA-256 of each token is stored, so the table cannot be used to
 * resume anyone's session. `family_id` groups every rotation descended from one
 * login, which is what makes a replayed token traceable to the session it came
 * from; `revoked_at` marks a token spent without deleting it, since a missing
 * row and a stolen one would otherwise look identical.
 *
 * Existing sessions are unaffected: this only adds a table. Access tokens
 * issued before the deploy stay valid until they expire, and their holders get
 * a refresh token the next time they log in.
 */
export class RefreshTokens1784450835694 implements MigrationInterface {
  name = 'RefreshTokens1784450835694';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" character varying(128) NOT NULL, "family_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "absolute_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "ip_address" character varying(64), "user_agent" character varying(255), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a7838d2ba25be1342091b6695f" ON "refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d5e27da0cd39bc3bb2811fc8ba" ON "refresh_tokens" ("family_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45d36c31cba19beca594c5934d" ON "refresh_tokens" ("user_id", "revoked_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_45d36c31cba19beca594c5934d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d5e27da0cd39bc3bb2811fc8ba"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a7838d2ba25be1342091b6695f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
