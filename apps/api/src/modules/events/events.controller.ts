import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { EventsService } from "./events.service";
import { CreateEventDto } from "./dto/create-event.dto";

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEvent(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.createEvent(createEventDto);
  }

  @Get(":id")
  async getEventById(@Param("id") id: string) {
    return this.eventsService.getEventById(id);
  }

  @Post(":id/generate-seats")
  @HttpCode(HttpStatus.OK)
  async generateSeats(@Param("id") id: string) {
    return this.eventsService.generateSeats(id);
  }
}
