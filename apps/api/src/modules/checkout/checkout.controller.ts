import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from "@nestjs/common";
import {
  ErrorCode,
  HoldRequestSchema,
  HoldResponse,
} from "@urticketbuddy/contracts";
import { CheckoutService } from "./checkout.service";

@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post("hold")
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
