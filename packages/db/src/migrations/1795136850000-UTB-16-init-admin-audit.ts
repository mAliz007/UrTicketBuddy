import { MigrationInterface, QueryRunner } from "typeorm";

export class Utb16InitAdminAudit1795136850000 implements MigrationInterface {
  name = "Utb16InitAdminAudit1795136850000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create platform_settings table
    await queryRunner.query(`
      CREATE TABLE "platform_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(100) NOT NULL,
        "value" character varying(255) NOT NULL DEFAULT '10',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_platform_settings_key" UNIQUE ("key"),
        CONSTRAINT "PK_platform_settings_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_platform_settings_key" ON "platform_settings" ("key");
    `);

    // Seed default commission_rate_percent = '10'
    await queryRunner.query(`
      INSERT INTO "platform_settings" ("key", "value")
      VALUES ('commission_rate_percent', '10')
      ON CONFLICT ("key") DO NOTHING;
    `);

    // 2. Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actorId" character varying(255) NOT NULL,
        "actorRole" character varying(50) NOT NULL,
        "action" character varying(100) NOT NULL,
        "entityType" character varying(100) NOT NULL,
        "entityId" character varying(255) NOT NULL,
        "summary" text,
        "beforeState" jsonb,
        "afterState" jsonb,
        "ipAddress" character varying(100),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_actor_id" ON "audit_logs" ("actorId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action");
    `);

    // 3. PostgreSQL trigger to enforce append-only immutability
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_immutable_fn()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs table is append-only and cannot be updated or deleted';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_audit_logs_immutable
      BEFORE UPDATE OR DELETE ON "audit_logs"
      FOR EACH ROW
      EXECUTE FUNCTION audit_logs_immutable_fn();
    `);

    // 4. Ensure events has organizerId for tenant ownership isolation
    await queryRunner.query(`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "organizerId" character varying(255);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_events_organizer_id" ON "events" ("organizerId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop trigger and immutability function
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON "audit_logs";`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS audit_logs_immutable_fn();`,
    );

    // 2. Drop audit_logs
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_action";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_actor_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);

    // 3. Drop platform_settings
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_platform_settings_key";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_settings";`);

    // 4. Drop organizerId on events
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_organizer_id";`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "organizerId";`,
    );
  }
}
