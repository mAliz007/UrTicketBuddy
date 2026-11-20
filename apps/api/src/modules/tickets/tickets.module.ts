import { Module } from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { TicketsController } from "./tickets.controller";
import { UserTicketsController } from "./user-tickets.controller";

@Module({
  controllers: [TicketsController, UserTicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
