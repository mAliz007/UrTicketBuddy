import { MigrationInterface, QueryRunner } from "typeorm";

export class Utb10InitOrders1794936850000 implements MigrationInterface {
  name = "Utb10InitOrders1794936850000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create orders table
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" character varying(255) NOT NULL,
        "eventId" uuid NOT NULL,
        "totalAmount" numeric(12,2) NOT NULL DEFAULT '0',
        "currency" character varying(10) NOT NULL DEFAULT 'PKR',
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "paymentGatewayRef" character varying(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_80f390b083014fd69ec40b8c38c" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_orders_user_id" ON "orders" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_orders_event_id" ON "orders" ("eventId");
    `);

    // 2. Create order_items table
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "eventSeatId" uuid NOT NULL,
        "price" numeric(12,2) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_3d40cd9b9c9fab977c139cd4b11" FOREIGN KEY ("eventSeatId") REFERENCES "event_seats"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_order_items_order_id" ON "order_items" ("orderId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_order_items_event_seat_id" ON "order_items" ("eventSeatId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_order_items_event_seat_id";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_items_order_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_event_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_user_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders";`);
  }
}
