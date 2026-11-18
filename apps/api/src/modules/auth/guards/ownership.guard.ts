import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { ErrorCode, UserRole } from "@urticketbuddy/contracts";

@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "Forbidden: user context not found",
      });
    }

    // Admins bypass ownership checks
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Check ownership against request params, body, or headers
    const resourceOwnerId =
      request.params?.userId ||
      request.params?.organizerId ||
      request.body?.organizerTenantId ||
      request.body?.userId;

    if (!resourceOwnerId) {
      return true;
    }

    const matchesUser = user.id === resourceOwnerId;
    const matchesTenant = user.organizerTenantId === resourceOwnerId;

    if (!matchesUser && !matchesTenant) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "Forbidden: you do not own this resource",
      });
    }

    return true;
  }
}
