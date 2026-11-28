import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { UserRole } from "@urticketbuddy/contracts";
import { AuditLogInterceptor } from "../admin/audit-log.interceptor";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ResaleService } from "./resale.service";

interface AuthenticatedUser {
  id?: string;
  userId?: string;
  email?: string;
  role: UserRole;
}

@Controller("resale")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class ResaleController {
  constructor(private readonly resaleService: ResaleService) {}

  @Post("listings")
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async createListing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const sellerId = user.id ?? user.userId;
    return this.resaleService.createListing(sellerId!, body);
  }

  @Patch("listings/:listingId")
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async updateListing(
    @Param("listingId", new ParseUUIDPipe()) listingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const sellerId = user.id ?? user.userId;
    return this.resaleService.updateListing(listingId, sellerId!, body);
  }

  @Public()
  @Get("listings")
  async getListings(
    @Query("eventId") eventId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.resaleService.getListings({ eventId, page, pageSize });
  }

  @Post("listings/:listingId/purchase")
  @Roles(UserRole.CUSTOMER, UserRole.ORGANIZER, UserRole.ADMIN)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async purchaseListing(
    @Param("listingId", new ParseUUIDPipe()) listingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    const buyerId = user.id ?? user.userId;
    return this.resaleService.purchaseListing(
      listingId,
      buyerId!,
      body,
      idempotencyKey,
    );
  }
}
