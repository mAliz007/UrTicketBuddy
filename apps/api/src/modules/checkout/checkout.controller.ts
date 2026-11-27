import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ErrorCode,
  EventSeatsHoldBodySchema,
  HoldRequestSchema,
  HoldResponse,
  ReleaseSeatsRequestSchema,
  UserRole,
} from "@urticketbuddy/contracts";
import { CheckoutService } from "./checkout.service";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

interface AuthenticatedCustomer {
  id?: string;
  userId?: string;
  sub?: string;
  role?: UserRole;
}

@Public()
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post("hold")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async holdSeats(
    @Headers("x-user-id") userIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<HoldResponse> {
    if (
      !userIdHeader ||
      typeof userIdHeader !== "string" ||
      userIdHeader.trim() === ""
    ) {
      throw new HttpException(
        {
          code: ErrorCode.UNAUTHORIZED,
          message: "Missing x-user-id header",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const parsed = HoldRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: "Invalid seat hold request",
          details: parsed.error.flatten(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.checkoutService.holdSeats(userIdHeader.trim(), parsed.data);
  }
}

@Controller("events/:eventId/seats")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventSeatsHoldController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post("hold")
  @Roles(UserRole.CUSTOMER)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async holdEventSeats(
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() body: unknown,
  ): Promise<HoldResponse> {
    const parsed = EventSeatsHoldBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: "Invalid seat hold request",
          details: parsed.error.flatten(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const userId = user?.id || user?.userId || user?.sub;
    if (!userId) {
      throw new HttpException(
        {
          code: ErrorCode.UNAUTHORIZED,
          message: "Authenticated customer ID is required",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.checkoutService.holdSeats(userId, {
      eventId,
      seatIds: parsed.data.seatIds,
      ttlSeconds: parsed.data.ttlSeconds,
      maxPerUser: parsed.data.maxPerUser,
    });
  }

  @Delete("hold")
  @Roles(UserRole.CUSTOMER)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async releaseEventSeats(
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() body: unknown,
  ) {
    const parsed = ReleaseSeatsRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: "Invalid seat release request",
          details: parsed.error.flatten(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const userId = user?.id || user?.userId || user?.sub;
    if (!userId) {
      throw new HttpException(
        {
          code: ErrorCode.UNAUTHORIZED,
          message: "Authenticated customer ID is required",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.checkoutService.releaseSeats(
      userId,
      eventId,
      parsed.data.seatIds,
    );
  }

  @Public()
  @Get("state")
  @HttpCode(HttpStatus.OK)
  async getEventSeatsState(
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
  ) {
    return this.checkoutService.getSeatsState(eventId);
  }
}
