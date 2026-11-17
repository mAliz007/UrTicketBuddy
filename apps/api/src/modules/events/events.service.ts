import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { Repository, In } from "typeorm";
import { Model } from "mongoose";
import { Event, Venue, EventSeat } from "@urticketbuddy/db";
import {
  generateGrid,
  generateArc,
  generateTableCluster,
} from "@urticketbuddy/venue-engine";
import { ErrorCode, SectionConfig, SeatNode } from "@urticketbuddy/contracts";
import {
  EVENT_REPOSITORY,
  VENUE_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  VENUE_LAYOUT_MODEL,
} from "../../database/database.tokens";
import { EventSeatCatalogPort } from "../../common/ports";
import { VenueLayoutDocument } from "../venues/schemas/venue-layout.schema";
import { CreateEventDto } from "./dto/create-event.dto";

export const CHUNK_SIZE = 1000;

@Injectable()
export class EventsService implements EventSeatCatalogPort {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @Inject(EVENT_REPOSITORY)
    private readonly eventRepository: Repository<Event>,
    @Inject(VENUE_REPOSITORY)
    private readonly venueRepository: Repository<Venue>,
    @Inject(EVENT_SEAT_REPOSITORY)
    private readonly eventSeatRepository: Repository<EventSeat>,
    @Inject(VENUE_LAYOUT_MODEL)
    private readonly venueLayoutModel: Model<VenueLayoutDocument>,
  ) {}

  async createEvent(dto: CreateEventDto): Promise<{
    id: string;
    venueId: string;
    name: string;
    startTime: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    if (!dto.name || typeof dto.name !== "string" || !dto.name.trim()) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Event name is required",
      });
    }

    if (
      !dto.venueId ||
      typeof dto.venueId !== "string" ||
      !dto.venueId.trim()
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Venue ID is required",
      });
    }

    if (!dto.startTime) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Start time is required",
      });
    }

    const startDate = new Date(dto.startTime);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid start time timestamp",
      });
    }

    // Verify venue exists in PostgreSQL
    const venue = await this.venueRepository.findOne({
      where: { id: dto.venueId },
    });
    if (!venue) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Venue with id ${dto.venueId} not found`,
      });
    }

    const event = this.eventRepository.create({
      venueId: dto.venueId,
      name: dto.name.trim(),
      startTime: startDate,
      status: dto.status || "DRAFT",
    });

    const savedEvent = await this.eventRepository.save(event);

    return {
      id: savedEvent.id,
      venueId: savedEvent.venueId,
      name: savedEvent.name,
      startTime: savedEvent.startTime,
      status: savedEvent.status,
      createdAt: savedEvent.createdAt,
      updatedAt: savedEvent.updatedAt,
    };
  }

  async getEventById(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ["venue"],
    });

    if (!event) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Event with id ${id} not found`,
      });
    }

    return event;
  }

  async generateSeats(eventId: string): Promise<{
    eventId: string;
    venueId: string;
    totalSeatsGenerated: number;
    status: string;
  }> {
    // 1. Fetch Event
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Event with id ${eventId} not found`,
      });
    }

    // 2. Fetch Venue
    const venue = await this.venueRepository.findOne({
      where: { id: event.venueId },
    });
    if (!venue) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Venue with id ${event.venueId} not found`,
      });
    }

    // 3. Fetch VenueLayout from MongoDB
    const layout = await this.venueLayoutModel
      .findById(venue.layoutMongoId)
      .lean();
    if (!layout) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Venue layout document ${venue.layoutMongoId} not found in MongoDB`,
      });
    }

    // 4. Calculate seats using venue-engine generators
    const generatedSeats: Array<{
      eventId: string;
      seatId: string;
      tierId: string | null;
      x: number;
      y: number;
      status: string;
    }> = [];

    const seenSeatIds = new Set<string>();

    if (Array.isArray(layout.sections)) {
      for (const section of layout.sections as unknown as SectionConfig[]) {
        if (section.type === "grid") {
          const seats = generateGrid({
            origin: section.origin,
            rows: section.rows,
            columns: section.columns,
            seatWidth: section.seatWidth,
            gapX: section.gapX,
            gapY: section.gapY,
            staggerOffset: section.staggerOffset,
            aisleColumns: section.aisleColumns,
            aisleWidth: section.aisleWidth,
            sectionId: section.id,
            tierId: section.tierId,
          });

          for (const s of seats) {
            if (!seenSeatIds.has(s.id)) {
              seenSeatIds.add(s.id);
              generatedSeats.push({
                eventId: event.id,
                seatId: s.id,
                tierId: s.tierId ?? null,
                x: s.x,
                y: s.y,
                status: "AVAILABLE",
              });
            }
          }
        } else if (section.type === "arc") {
          const seats = generateArc({
            center: section.center,
            thetaStart: section.thetaStart,
            thetaEnd: section.thetaEnd,
            rInner: section.rInner,
            rowGap: section.rowGap,
            rows: section.rows,
            seatWidth: section.seatWidth,
            gapX: section.gapX,
            sectionId: section.id,
            tierId: section.tierId,
            isDegrees: true,
          });

          for (const s of seats) {
            if (!seenSeatIds.has(s.id)) {
              seenSeatIds.add(s.id);
              generatedSeats.push({
                eventId: event.id,
                seatId: s.id,
                tierId: s.tierId ?? null,
                x: s.x,
                y: s.y,
                status: "AVAILABLE",
              });
            }
          }
        } else if (section.type === "table") {
          const group = generateTableCluster({
            center: section.center,
            tableRadius: section.tableRadius,
            seatCount: section.seatCount,
            seatWidth: section.seatWidth,
            sectionId: section.id,
            tierId: section.tierId,
            startAngle: section.startAngle,
            isDegrees: true,
          });

          for (const s of group.seats) {
            if (!seenSeatIds.has(s.id)) {
              seenSeatIds.add(s.id);
              generatedSeats.push({
                eventId: event.id,
                seatId: s.id,
                tierId: s.tierId ?? null,
                x: s.x,
                y: s.y,
                status: "AVAILABLE",
              });
            }
          }
        }
      }
    }

    // Explicit seats in layout
    if (Array.isArray(layout.seats)) {
      for (const s of layout.seats as unknown as SeatNode[]) {
        if (!seenSeatIds.has(s.id)) {
          seenSeatIds.add(s.id);
          generatedSeats.push({
            eventId: event.id,
            seatId: s.id,
            tierId: s.tierId ?? null,
            x: s.x,
            y: s.y,
            status: "AVAILABLE",
          });
        }
      }
    }

    // 5. Clean up existing seats for idempotency
    await this.eventSeatRepository.delete({ eventId: event.id });

    // 6. Bulk insert in chunks of 1,000 to prevent database memory exhaustion
    for (let i = 0; i < generatedSeats.length; i += CHUNK_SIZE) {
      const chunk = generatedSeats.slice(i, i + CHUNK_SIZE);
      await this.eventSeatRepository.insert(chunk);
    }

    this.logger.log(
      `Generated ${generatedSeats.length} seats for event ${eventId} in chunks of ${CHUNK_SIZE}`,
    );

    return {
      eventId: event.id,
      venueId: venue.id,
      totalSeatsGenerated: generatedSeats.length,
      status: "COMPLETED",
    };
  }

  async getSeatAvailability(
    eventId: string,
    seatIds: string[],
  ): Promise<Map<string, boolean>> {
    const seats = await this.eventSeatRepository.find({
      where: { eventId, seatId: In(seatIds) },
    });

    const availabilityMap = new Map<string, boolean>();
    for (const seatId of seatIds) {
      const found = seats.find((s) => s.seatId === seatId);
      availabilityMap.set(seatId, found?.status === "AVAILABLE");
    }

    return availabilityMap;
  }
}
