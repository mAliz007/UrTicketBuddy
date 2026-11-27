import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import { VenuesService } from "./venues.service";
import { CreateVenueDto, VenueActor } from "./dto/create-venue.dto";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller(["venues", "organizer/venues"])
@UseGuards(JwtAuthGuard, RolesGuard)
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  async createVenue(
    @Body() createVenueDto: CreateVenueDto,
    @CurrentUser() user?: VenueActor,
  ) {
    if (user) {
      return this.venuesService.createVenue(createVenueDto, user);
    }
    return this.venuesService.createVenue(createVenueDto);
  }

  @Put(":id/layout")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  async updateVenueLayout(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user?: VenueActor,
  ) {
    return this.venuesService.updateVenueLayout(id, body, user);
  }

  @Public()
  @Get(":id")
  async getVenueById(@Param("id") id: string) {
    return this.venuesService.getVenueById(id);
  }
}
