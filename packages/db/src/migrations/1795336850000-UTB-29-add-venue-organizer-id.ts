import { MigrationInterface, QueryRunner } from "typeorm";

export class Utb29AddVenueOrganizerId1795336850000 implements MigrationInterface {
  name = "Utb29AddVenueOrganizerId1795336850000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "organizerId" character varying(255);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_venues_organizer_id" ON "venues" ("organizerId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_venues_organizer_id";`);
    await queryRunner.query(
      `ALTER TABLE "venues" DROP COLUMN IF EXISTS "organizerId";`,
    );
  }
}
