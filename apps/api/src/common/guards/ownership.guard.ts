import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ErrorCode, UserRole } from "@urticketbuddy/contracts";

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector?: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    // Extract target tenant ID from request parameters, query, body, or headers
    const targetTenantId =
      request.params?.organizerId ||
      request.params?.tenantId ||
      request.query?.organizerId ||
      request.query?.tenantId ||
      request.body?.organizerId ||
      request.body?.tenantId ||
      request.headers["x-tenant-id"];

    const userTenantId =
      user.organizerTenantId || user.tenantId || user.id || user.userId;

    if (targetTenantId && userTenantId && targetTenantId !== userTenantId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message:
          "Cross-tenant access forbidden: resource belongs to another organizer",
      });
    }

    return true;
  }
}
