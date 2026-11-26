import { MigrationInterface, QueryRunner } from "typeorm";

export class Utb17AddTicketUniqueSeatIdx1795236850000 implements MigrationInterface {
  name = "Utb17AddTicketUniqueSeatIdx1795236850000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_active_ticket_seat" 
      ON "tickets" ("eventId", "eventSeatId") 
      WHERE "status" IN ('ISSUED', 'CHECKED_IN');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "uq_active_ticket_seat";
    `);
  }
}
