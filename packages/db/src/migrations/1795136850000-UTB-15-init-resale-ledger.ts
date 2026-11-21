import { MigrationInterface, QueryRunner } from "typeorm";

export class Utb15InitResaleLedger1795136850000 implements MigrationInterface {
  name = "Utb15InitResaleLedger1795136850000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create resale_listings table
    await queryRunner.query(`
      CREATE TABLE "resale_listings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticketId" uuid NOT NULL,
        "eventId" uuid NOT NULL,
        "sellerId" character varying(255) NOT NULL,
        "askingPriceMinor" integer NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resale_listings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_6f3aa262c5f7947d2adb51d3f36" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_23c4922b768155c827d32122952" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_resale_listings_ticket_id" ON "resale_listings" ("ticketId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_resale_listings_event_id" ON "resale_listings" ("eventId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_resale_listings_seller_id" ON "resale_listings" ("sellerId");
    `);

    // 2. Create ledger_entries table
    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "listingId" uuid NOT NULL,
        "account" character varying(255) NOT NULL,
        "amountMinor" integer NOT NULL,
        "kind" character varying(50) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ledger_entries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_06ca5804051219422c87e507899" FOREIGN KEY ("listingId") REFERENCES "resale_listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_ledger_entries_listing_id" ON "ledger_entries" ("listingId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_ledger_entries_listing_id";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_entries";`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_resale_listings_seller_id";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_resale_listings_event_id";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_resale_listings_ticket_id";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "resale_listings";`);
  }
}
