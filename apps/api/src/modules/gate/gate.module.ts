import { Module } from "@nestjs/common";
import { GateService } from "./gate.service";
import { GateController } from "./gate.controller";
import { TicketsModule } from "../tickets/tickets.module";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [TicketsModule, AdminModule],
  controllers: [GateController],
  providers: [GateService],
  exports: [GateService],
})
export class GateModule {}
