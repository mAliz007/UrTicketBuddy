import { MigrationInterface, QueryRunner } from "typeorm";

export class Utb14InitTicketsGateScans1795036850000 implements MigrationInterface {
  name = "Utb14InitTicketsGateScans1795036850000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create tickets table
    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "eventSeatId" uuid NOT NULL,
        "orderId" uuid NOT NULL,
        "ownerId" character varying(255) NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'ISSUED',
        "seedVersion" integer NOT NULL DEFAULT 1,
        "faceValueMinor" integer NOT NULL DEFAULT 100000,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tickets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_8a101375d173c39a7c1d02c9d7d" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_265db83fa22115be54165ab4c24" FOREIGN KEY ("eventSeatId") REFERENCES "event_seats"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_e3e1e1e9d4ee34649da54a016e4" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tickets_event_id" ON "tickets" ("eventId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tickets_event_seat_id" ON "tickets" ("eventSeatId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tickets_order_id" ON "tickets" ("orderId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tickets_owner_id" ON "tickets" ("ownerId");
    `);

    // 2. Create gate_scans table
    await queryRunner.query(`
      CREATE TABLE "gate_scans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticketId" uuid,
        "scannedTicketRef" character varying(255),
        "eventId" uuid NOT NULL,
        "scannedBy" character varying(255) NOT NULL,
        "result" character varying(50) NOT NULL,
        "scannedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gate_scans_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_594f94930d041a64fef309e6252" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_eb2d496837fe287e6d5218e5fe3" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_gate_scans_ticket_id" ON "gate_scans" ("ticketId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_gate_scans_event_id" ON "gate_scans" ("eventId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_gate_scans_event_scanned_at" ON "gate_scans" ("eventId", "scannedAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_gate_scans_event_scanned_at";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_gate_scans_event_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_gate_scans_ticket_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gate_scans";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tickets_owner_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tickets_order_id";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tickets_event_seat_id";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tickets_event_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tickets";`);
  }
}
