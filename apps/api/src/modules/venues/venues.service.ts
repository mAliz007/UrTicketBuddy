import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  UnprocessableEntityException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { Repository } from "typeorm";
import { Model } from "mongoose";
import { Venue, Event } from "@urticketbuddy/db";
import { parseLayout, InvalidLayoutError } from "@urticketbuddy/venue-engine";
import { ErrorCode, UserRole } from "@urticketbuddy/contracts";
import {
  VENUE_REPOSITORY,
  VENUE_LAYOUT_MODEL,
  EVENT_REPOSITORY,
} from "../../database/database.tokens";
import { VenueLayoutDocument } from "./schemas/venue-layout.schema";
import { CreateVenueDto, VenueActor } from "./dto/create-venue.dto";

@Injectable()
export class VenuesService {
  private readonly logger = new Logger(VenuesService.name);

  constructor(
    @Inject(VENUE_REPOSITORY)
    private readonly venueRepository: Repository<Venue>,
    @Inject(VENUE_LAYOUT_MODEL)
    private readonly venueLayoutModel: Model<VenueLayoutDocument>,
    @Optional()
    @Inject(EVENT_REPOSITORY)
    private readonly eventRepository?: Repository<Event>,
  ) {}

  private validateAndParseLayout(layout: unknown): Record<string, unknown> {
    try {
      parseLayout(layout);
    } catch (err: unknown) {
      const message =
        err instanceof InvalidLayoutError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Invalid venue layout";
      const details = (err as { issues?: unknown }).issues;
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message,
        details,
      });
    }

    return (typeof layout === "string" ? JSON.parse(layout) : layout) as Record<
      string,
      unknown
    >;
  }

  private assertVenueOwnership(venue: Venue, actor?: VenueActor): void {
    if (!actor || actor.role === UserRole.ADMIN || !venue.organizerId) {
      return;
    }
    const tenantId = actor.organizerTenantId;
    const userId = actor.id || actor.userId;
    const isOwner =
      (tenantId && venue.organizerId === tenantId) ||
      (userId && venue.organizerId === userId);
    if (!isOwner) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "Forbidden: You do not own this venue",
      });
    }
  }

  async createVenue(
    dto: CreateVenueDto,
    actor?: VenueActor,
  ): Promise<{
    id: string;
    organizerId: string | null;
    name: string;
    location: string;
    layoutMongoId: string;
    version: number;
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
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Venue layout is required",
      });
    }

    // 1. Validate layout with venue-engine parser (422 Unprocessable Entity on invalid layout)
    const layoutPayload = this.validateAndParseLayout(dto.layout);

    // 2. Persist layout to MongoDB with version = 1
    const layoutDoc = new this.venueLayoutModel({
      ...layoutPayload,
      version: 1,
      previousLayoutId: null,
    });
    const savedLayout = await layoutDoc.save();
    const layoutMongoId = savedLayout._id.toString();

    const organizerId =
      actor?.role === UserRole.ADMIN
        ? (dto.organizerId ??
          actor?.organizerTenantId ??
          actor?.id ??
          actor?.userId ??
          null)
        : (actor?.organizerTenantId ?? actor?.id ?? actor?.userId ?? null);

    // 3. Persist venue to PostgreSQL
    const venue = this.venueRepository.create({
      organizerId,
      name: dto.name.trim(),
      location: dto.location.trim(),
      layoutMongoId,
    });
    const savedVenue = await this.venueRepository.save(venue);

    return {
      id: savedVenue.id,
      organizerId: savedVenue.organizerId ?? null,
      name: savedVenue.name,
      location: savedVenue.location,
      layoutMongoId: savedVenue.layoutMongoId,
      version: 1,
      createdAt: savedVenue.createdAt,
      updatedAt: savedVenue.updatedAt,
    };
  }

  async updateVenueLayout(
    venueId: string,
    body: unknown,
    actor?: VenueActor,
  ): Promise<{
    id: string;
    name: string;
    location: string;
    layoutMongoId: string;
    previousLayoutId: string;
    version: number;
    layout: unknown;
    updatedAt: Date;
  }> {
    const venue = await this.venueRepository.findOne({
      where: { id: venueId },
    });
    if (!venue) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Venue with id ${venueId} not found`,
      });
    }

    this.assertVenueOwnership(venue, actor);

    // Check structure lock: cannot mutate venue layout if an associated event is PUBLISHED
    if (
      this.eventRepository &&
      typeof this.eventRepository.find === "function"
    ) {
      const events = await this.eventRepository.find({
        where: { venueId: venue.id },
      });
      if (
        Array.isArray(events) &&
        events.some((e) => e.status === "PUBLISHED")
      ) {
        throw new ConflictException({
          code: ErrorCode.STRUCTURE_LOCKED,
          message:
            "Venue structure is locked because an associated event is already published",
        });
      }
    }

    const bodyObj =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const rawLayout = "layout" in bodyObj ? bodyObj.layout : body;
    const expectedVersion =
      typeof bodyObj.expectedVersion === "number"
        ? bodyObj.expectedVersion
        : undefined;

    if (!rawLayout) {
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Venue layout is required",
      });
    }

    const layoutPayload = this.validateAndParseLayout(rawLayout);

    let prevLayout: { version?: number } | null = null;
    try {
      const found = this.venueLayoutModel.findById(venue.layoutMongoId);
      prevLayout =
        found && typeof found.lean === "function"
          ? ((await found.lean()) as { version?: number } | null)
          : ((await found) as { version?: number } | null);
    } catch (err) {
      this.logger.warn(
        `Could not read previous layout ${venue.layoutMongoId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const currentVersion =
      typeof prevLayout?.version === "number" ? prevLayout.version : 1;

    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `Layout version conflict: expected ${expectedVersion}, current is ${currentVersion}`,
      });
    }

    const nextVersion = currentVersion + 1;
    const previousLayoutId = venue.layoutMongoId;

    const versionedPayload = {
      ...layoutPayload,
      version: nextVersion,
      previousLayoutId,
    };

    const newLayoutDoc = new this.venueLayoutModel(versionedPayload);
    const savedLayout = await newLayoutDoc.save();
    const newLayoutMongoId = savedLayout._id.toString();

    venue.layoutMongoId = newLayoutMongoId;
    const savedVenue = await this.venueRepository.save(venue);

    return {
      id: savedVenue.id,
      name: savedVenue.name,
      location: savedVenue.location,
      layoutMongoId: savedVenue.layoutMongoId,
      previousLayoutId,
      version: nextVersion,
      layout: {
        _id: newLayoutMongoId,
        ...versionedPayload,
      },
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
