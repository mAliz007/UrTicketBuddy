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
        message: "Tenant context missing: user unauthenticated",
      });
    }

    // Admins bypass tenant isolation with global platform access
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Check organizer / tenant isolation
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

    return true;
  }
}
