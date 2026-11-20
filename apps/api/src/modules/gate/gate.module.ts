import { Module } from "@nestjs/common";
import { GateService } from "./gate.service";
import { GateController } from "./gate.controller";
import { TicketsModule } from "../tickets/tickets.module";

@Module({
  imports: [TicketsModule],
  controllers: [GateController],
  providers: [GateService],
  exports: [GateService],
})
export class GateModule {}
