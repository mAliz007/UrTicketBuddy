import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import { EventsService } from "./events.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("events")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  async createEvent(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.createEvent(createEventDto);
  }

  @Public()
  @Get(":id")
  async getEventById(@Param("id") id: string) {
    return this.eventsService.getEventById(id);
  }

  @Post(":id/generate-seats")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  async generateSeats(@Param("id") id: string) {
    return this.eventsService.generateSeats(id);
  }
}
