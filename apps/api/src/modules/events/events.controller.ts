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
import { AuthUser, UserRole } from "@urticketbuddy/contracts";
import { EventsService } from "./events.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OwnershipGuard } from "../auth/guards/ownership.guard";

@Controller("events")
@UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  async createEvent(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.eventsService.createEvent(createEventDto, user);
  }

  @Public()
  @Get(":id")
  async getEventById(@Param("id") id: string) {
    return this.eventsService.getEventById(id);
  }

  @Post(":id/generate-seats")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  async generateSeats(@Param("id") id: string, @CurrentUser() user?: AuthUser) {
    return this.eventsService.generateSeats(id, user);
  }
}
