import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Repository } from "typeorm";
import { Event, Venue } from "@urticketbuddy/db";
import { ErrorCode, UserRole } from "@urticketbuddy/contracts";
import {
  EVENT_REPOSITORY,
  VENUE_REPOSITORY,
} from "../../../database/database.tokens";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    @Optional()
    @Inject(Reflector)
    private readonly reflector?: Reflector,
    @Optional()
    @Inject(VENUE_REPOSITORY)
    private readonly venueRepository?: Repository<Venue>,
    @Optional()
    @Inject(EVENT_REPOSITORY)
    private readonly eventRepository?: Repository<Event>,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    if (this.reflector) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (isPublic) {
        return true;
      }
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "Tenant context missing: user unauthenticated",
      });
    }

    // Admins bypass tenant isolation with global platform access
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Check organizer / tenant isolation from explicit request fields
    const targetTenantId =
      request.params?.organizerId ||
      request.params?.tenantId ||
      request.query?.organizerId ||
      request.query?.tenantId ||
      request.body?.organizerTenantId ||
      request.body?.organizerId ||
      request.body?.tenantId ||
      request.headers?.["x-tenant-id"];

    const userTenantId =
      user.organizerTenantId || user.tenantId || user.id || user.userId;

    if (targetTenantId && userTenantId && targetTenantId !== userTenantId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message:
          "Cross-tenant access forbidden: resource belongs to another organizer",
      });
    }

    // Check individual user resource ownership
    const targetUserId = request.params?.userId || request.body?.userId;
    const currentUserId = user.id || user.userId;

    if (targetUserId && currentUserId && targetUserId !== currentUserId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "Forbidden: you do not own this resource",
      });
    }

    // Check database resource ownership when repositories are available
    const venueIdFromBody =
      typeof request.body?.venueId === "string"
        ? request.body.venueId
        : undefined;
    const routePath = String(
      request.route?.path || request.path || request.url || "",
    );
    const paramEventId =
      request.params?.eventId ||
      (routePath.includes("events") ? request.params?.id : undefined);
    const paramVenueId = routePath.includes("venues")
      ? request.params?.id
      : undefined;

    const canLookupVenue = typeof this.venueRepository?.findOne === "function";
    const canLookupEvent = typeof this.eventRepository?.findOne === "function";

    if (
      (venueIdFromBody && canLookupVenue) ||
      (paramVenueId && canLookupVenue) ||
      (paramEventId && canLookupEvent)
    ) {
      return this.verifyResourceOwnership(
        userTenantId,
        venueIdFromBody,
        paramVenueId,
        paramEventId,
      );
    }

    return true;
  }

  private async verifyResourceOwnership(
    userTenantId: string | undefined,
    venueIdFromBody?: string,
    paramVenueId?: string,
    paramEventId?: string,
  ): Promise<boolean> {
    if (
      venueIdFromBody &&
      typeof this.venueRepository?.findOne === "function"
    ) {
      const venue = await this.venueRepository.findOne({
        where: { id: venueIdFromBody },
      });
      if (venue?.organizerId && venue.organizerId !== userTenantId) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message:
            "Cross-tenant access forbidden: venue belongs to another organizer",
        });
      }
    }

    if (paramVenueId && typeof this.venueRepository?.findOne === "function") {
      const venue = await this.venueRepository.findOne({
        where: { id: paramVenueId },
      });
      if (venue?.organizerId && venue.organizerId !== userTenantId) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message:
            "Cross-tenant access forbidden: venue belongs to another organizer",
        });
      }
    }

    if (paramEventId && typeof this.eventRepository?.findOne === "function") {
      const event = await this.eventRepository.findOne({
        where: { id: paramEventId },
      });
      if (event?.organizerId && event.organizerId !== userTenantId) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message:
            "Cross-tenant access forbidden: event belongs to another organizer",
        });
      }
    }

    return true;
  }
}
