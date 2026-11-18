import { MigrationInterface, QueryRunner } from "typeorm";

export class Utb3InitUsers1794837000000 implements MigrationInterface {
  name = "Utb3InitUsers1794837000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(255) NOT NULL,
        "passwordHash" character varying(255) NOT NULL,
        "firstName" character varying(100) NOT NULL,
        "lastName" character varying(100) NOT NULL,
        "role" character varying(20) NOT NULL DEFAULT 'CUSTOMER',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_users_email" ON "users" ("email");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_users_role" ON "users" ("role");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_role";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}
