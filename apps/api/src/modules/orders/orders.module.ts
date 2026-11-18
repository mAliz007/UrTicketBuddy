import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { MockPaymentService } from "./payment/mock-payment.service";

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, MockPaymentService],
  exports: [OrdersService, MockPaymentService],
})
export class OrdersModule {}
