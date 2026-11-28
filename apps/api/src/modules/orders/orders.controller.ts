import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthUser, ErrorCode, UserRole } from "@urticketbuddy/contracts";
import { OrdersService } from "./orders.service";
import { CheckoutDto } from "./dto/checkout.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("checkout")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CUSTOMER)
  async checkout(
    @CurrentUser() user: AuthUser | undefined,
    @Body() checkoutDto: CheckoutDto,
    @Headers("idempotency-key") idempotencyKeyHeader?: string,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: "Authenticated user is required",
      });
    }

    const payload: CheckoutDto = {
      ...checkoutDto,
      idempotencyKey:
        checkoutDto.idempotencyKey || idempotencyKeyHeader || undefined,
    };
    return this.ordersService.checkout(user.id, payload);
  }

  @Get(":id")
  @Roles(UserRole.CUSTOMER, UserRole.ORGANIZER, UserRole.ADMIN)
  async getOrderById(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.getOrderById(id, user);
  }
}
