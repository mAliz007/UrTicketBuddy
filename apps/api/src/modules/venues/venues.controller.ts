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
import { VenuesService } from "./venues.service";
import { CreateVenueDto } from "./dto/create-venue.dto";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("venues")
@UseGuards(JwtAuthGuard, RolesGuard)
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  async createVenue(@Body() createVenueDto: CreateVenueDto) {
    return this.venuesService.createVenue(createVenueDto);
  }

  @Public()
  @Get(":id")
  async getVenueById(@Param("id") id: string) {
    return this.venuesService.getVenueById(id);
  }
}
