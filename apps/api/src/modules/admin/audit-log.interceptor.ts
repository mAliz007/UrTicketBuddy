import {
  Injectable,
  Optional,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AuditService } from "./audit.service";

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(@Optional() private readonly auditService?: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const method = req?.method;

    // Automatically audit mutating HTTP operations (POST, PUT, PATCH, DELETE)
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    if (!isMutation || !this.auditService) {
      return next.handle();
    }

    const user = req.user || {
      id: "anonymous",
      userId: "anonymous",
      role: "ANONYMOUS",
    };
    const actorId = user.id || user.userId || user.email || "anonymous";
    const actorRole = user.role || "ANONYMOUS";
    const ipAddress =
      req.headers?.["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      null;

    const action = `${method} ${req.route?.path || req.path || req.url}`;
    const entityType = req.baseUrl || "API";
    const entityId =
      req.params?.id ||
      req.params?.orderId ||
      req.params?.ticketId ||
      req.params?.userId ||
      req.params?.eventId ||
      "N/A";

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          this.auditService
            ?.recordLog({
              actorId: String(actorId),
              actorRole: String(actorRole),
              action,
              entityType: String(entityType),
              entityId: String(entityId),
              summary: `Mutation completed successfully with status ${http.getResponse()?.statusCode || 200}`,
              ipAddress: typeof ipAddress === "string" ? ipAddress : null,
              afterState:
                responseBody && typeof responseBody === "object"
                  ? (responseBody as Record<string, unknown>)
                  : null,
            })
            ?.catch(() => {
              // Non-blocking interceptor failure suppression
            });
        },
      }),
    );
  }
}
