import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { Repository } from "typeorm";
import { Model } from "mongoose";
import { Venue } from "@urticketbuddy/db";
import { parseLayout, InvalidLayoutError } from "@urticketbuddy/venue-engine";
import { ErrorCode } from "@urticketbuddy/contracts";
import {
  VENUE_REPOSITORY,
  VENUE_LAYOUT_MODEL,
} from "../../database/database.tokens";
import { VenueLayoutDocument } from "./schemas/venue-layout.schema";
import { CreateVenueDto } from "./dto/create-venue.dto";

@Injectable()
export class VenuesService {
  private readonly logger = new Logger(VenuesService.name);

  constructor(
    @Inject(VENUE_REPOSITORY)
    private readonly venueRepository: Repository<Venue>,
    @Inject(VENUE_LAYOUT_MODEL)
    private readonly venueLayoutModel: Model<VenueLayoutDocument>,
  ) {}

  async createVenue(dto: CreateVenueDto): Promise<{
    id: string;
    name: string;
    location: string;
    layoutMongoId: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    if (!dto.name || typeof dto.name !== "string" || !dto.name.trim()) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Venue name is required",
      });
    }

    if (
      !dto.location ||
      typeof dto.location !== "string" ||
      !dto.location.trim()
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Venue location is required",
      });
    }

    if (!dto.layout) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Venue layout is required",
      });
    }

    // 1. Validate layout with venue-engine parser
    try {
      parseLayout(dto.layout);
    } catch (err: unknown) {
      const message =
        err instanceof InvalidLayoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Invalid venue layout";
      const details = (err as { issues?: unknown }).issues;
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message,
        details,
      });
    }

    // 2. Persist layout to MongoDB
    const layoutPayload =
      typeof dto.layout === "string" ? JSON.parse(dto.layout) : dto.layout;

    const layoutDoc = new this.venueLayoutModel(layoutPayload);
    const savedLayout = await layoutDoc.save();
    const layoutMongoId = savedLayout._id.toString();

    // 3. Persist venue to PostgreSQL
    const venue = this.venueRepository.create({
      name: dto.name.trim(),
      location: dto.location.trim(),
      layoutMongoId,
    });
    const savedVenue = await this.venueRepository.save(venue);

    return {
      id: savedVenue.id,
      name: savedVenue.name,
      location: savedVenue.location,
      layoutMongoId: savedVenue.layoutMongoId,
      createdAt: savedVenue.createdAt,
      updatedAt: savedVenue.updatedAt,
    };
  }

  async getVenueById(id: string): Promise<{
    id: string;
    name: string;
    location: string;
    layoutMongoId: string;
    layout: unknown;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const venue = await this.venueRepository.findOne({ where: { id } });
    if (!venue) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Venue with id ${id} not found`,
      });
    }

    let layout: unknown = null;
    try {
      layout = await this.venueLayoutModel.findById(venue.layoutMongoId).lean();
    } catch (err) {
      this.logger.warn(
        `Failed to fetch MongoDB layout ${venue.layoutMongoId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      id: venue.id,
      name: venue.name,
      location: venue.location,
      layoutMongoId: venue.layoutMongoId,
      layout,
      createdAt: venue.createdAt,
      updatedAt: venue.updatedAt,
    };
  }
}
