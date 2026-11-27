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
import { VenuesService } from "./venues.service";
import { CreateVenueDto } from "./dto/create-venue.dto";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OwnershipGuard } from "../auth/guards/ownership.guard";

@Controller("venues")
@UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  async createVenue(
    @Body() createVenueDto: CreateVenueDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.venuesService.createVenue(createVenueDto, user);
  }

  @Public()
  @Get(":id")
  async getVenueById(@Param("id") id: string) {
    return this.venuesService.getVenueById(id);
  }
}
