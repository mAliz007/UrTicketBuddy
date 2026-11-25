import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CheckoutDto } from "./dto/checkout.dto";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("checkout")
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Body() checkoutDto: CheckoutDto,
    @Headers("x-user-id") userIdHeader?: string,
    @Headers("idempotency-key") idempotencyKeyHeader?: string,
  ) {
    const payload: CheckoutDto = {
      ...checkoutDto,
      userId: checkoutDto.userId || userIdHeader || undefined,
      idempotencyKey:
        checkoutDto.idempotencyKey || idempotencyKeyHeader || undefined,
    };
    return this.ordersService.checkout(payload);
  }

  @Get(":id")
  async getOrderById(@Param("id") id: string) {
    return this.ordersService.getOrderById(id);
  }
}
