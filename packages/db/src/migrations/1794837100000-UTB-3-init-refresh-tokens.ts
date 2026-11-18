import { MigrationInterface, QueryRunner } from "typeorm";

export class Utb3InitRefreshTokens1794837100000 implements MigrationInterface {
  name = "Utb3InitRefreshTokens1794837100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add organizerTenantId column and index to users
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organizerTenantId" uuid;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_organizer_tenant_id" ON "users" ("organizerTenantId");
    `);

    // 2. Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying(255) NOT NULL,
        "familyId" uuid NOT NULL,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" ("tokenHash");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_family_id" ON "refresh_tokens" ("familyId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_refresh_tokens_family_id";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_refresh_tokens_token_hash";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_refresh_tokens_user_id";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens";`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_organizer_tenant_id";`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "organizerTenantId";`,
    );
  }
}
