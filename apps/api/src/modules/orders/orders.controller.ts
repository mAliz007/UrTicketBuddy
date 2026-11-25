import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import { OrdersService } from "./orders.service";
import { CheckoutDto } from "./dto/checkout.dto";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @Post("checkout")
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Body() checkoutDto: CheckoutDto,
    @Headers("x-user-id") userIdHeader?: string,
  ) {
    const payload: CheckoutDto = {
      ...checkoutDto,
      userId: checkoutDto.userId || userIdHeader || undefined,
    };
    return this.ordersService.checkout(payload);
  }

  @Get(":id")
  @Roles(UserRole.CUSTOMER, UserRole.ORGANIZER, UserRole.ADMIN)
  async getOrderById(@Param("id") id: string) {
    return this.ordersService.getOrderById(id);
  }
}
