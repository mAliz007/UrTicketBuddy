import { MigrationInterface, QueryRunner } from "typeorm";

export class UTB23F4F6TiersVenueOwnerAuditRole1795336850000 implements MigrationInterface {
  name = "UTB23F4F6TiersVenueOwnerAuditRole1795336850000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add organizerId column and covering index to venues table (F-4)
    await queryRunner.query(`
      ALTER TABLE "venues"
      ADD COLUMN IF NOT EXISTS "organizerId" character varying(255)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_venues_organizer_id" ON "venues" ("organizerId")
    `);

    // 2. Create ticket_tiers table with PK, FK to events, and covering FK index (F-4)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ticket_tiers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "priceMinor" integer NOT NULL,
        "currency" character varying(10) NOT NULL DEFAULT 'PKR',
        "capacity" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_917cfec124fa5e8ce04d1e7b865" PRIMARY KEY ("id"),
        CONSTRAINT "FK_a9059a9111a2206081a347d3b6e" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ticket_tiers_event_id" ON "ticket_tiers" ("eventId")
    `);

    // 3. Create restricted INSERT and SELECT-only database role for audit_logs (F-6)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'utb_app_audit_role') THEN
          CREATE ROLE utb_app_audit_role NOLOGIN;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      GRANT USAGE ON SCHEMA public TO utb_app_audit_role;
      GRANT SELECT, INSERT ON TABLE "audit_logs" TO utb_app_audit_role;
      REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_logs" FROM utb_app_audit_role;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'utb_app_audit_role') THEN
          REVOKE ALL PRIVILEGES ON TABLE "audit_logs" FROM utb_app_audit_role;
          REVOKE USAGE ON SCHEMA public FROM utb_app_audit_role;
          DROP ROLE utb_app_audit_role;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ticket_tiers_event_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_tiers"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_venues_organizer_id"`);
    await queryRunner.query(
      `ALTER TABLE "venues" DROP COLUMN IF EXISTS "organizerId"`,
    );
  }
}
