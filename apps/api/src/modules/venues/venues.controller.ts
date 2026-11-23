import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { VenuesService } from "./venues.service";
import { CreateVenueDto } from "./dto/create-venue.dto";
import { Public } from "../auth/decorators/public.decorator";

@Public()
@Controller("venues")
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createVenue(@Body() createVenueDto: CreateVenueDto) {
    return this.venuesService.createVenue(createVenueDto);
  }

  @Get(":id")
  async getVenueById(@Param("id") id: string) {
    return this.venuesService.getVenueById(id);
  }
}
