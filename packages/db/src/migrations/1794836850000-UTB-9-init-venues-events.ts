import { MigrationInterface, QueryRunner } from "typeorm";

export class Utb9InitVenuesEvents1794836850000 implements MigrationInterface {
  name = "Utb9InitVenuesEvents1794836850000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create venues table
    await queryRunner.query(`
      CREATE TABLE "venues" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "location" character varying(255) NOT NULL,
        "layoutMongoId" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_venues_id" PRIMARY KEY ("id")
      );
    `);

    // 2. Create events table
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "venueId" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "startTime" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'DRAFT',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_events_venue_id" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_events_venue_id" ON "events" ("venueId");
    `);

    // 3. Create event_seats table
    await queryRunner.query(`
      CREATE TABLE "event_seats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "seatId" character varying(100) NOT NULL,
        "tierId" character varying(100),
        "x" double precision NOT NULL,
        "y" double precision NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'AVAILABLE',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_seats_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_seats_event_id" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_event_seats_event_seat" UNIQUE ("eventId", "seatId")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_event_seats_event_id" ON "event_seats" ("eventId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_event_seats_seat_id" ON "event_seats" ("seatId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_event_seats_seat_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_event_seats_event_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_seats";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_venue_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events";`);

    await queryRunner.query(`DROP TABLE IF EXISTS "venues";`);
  }
}
