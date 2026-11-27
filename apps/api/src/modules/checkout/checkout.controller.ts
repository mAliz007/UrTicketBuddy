import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  AuthUser,
  ErrorCode,
  HoldRequestSchema,
  HoldResponse,
  UserRole,
} from "@urticketbuddy/contracts";
import { CheckoutService } from "./checkout.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("checkout")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post("hold")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CUSTOMER)
  async holdSeats(
    @CurrentUser() user: AuthUser | undefined,
    @Body() body: unknown,
  ): Promise<HoldResponse> {
    if (!user?.id) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: "Authenticated user is required",
      });
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

    return this.checkoutService.holdSeats(user.id, parsed.data);
  }
}
