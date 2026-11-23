import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { Response, Request } from "express";
import { ErrorCode } from "@urticketbuddy/contracts";

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_SERVER_ERROR;
    let message = "An unexpected error occurred";
    let details: unknown = undefined;

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = ErrorCode.TOO_MANY_REQUESTS;
      message = exception.message || "Too many requests";
      response.setHeader("Retry-After", "60");
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code = ErrorCode.TOO_MANY_REQUESTS;
        message = "Too many requests";
        response.setHeader("Retry-After", "60");
      } else if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) || exception.message;
        if (resObj.code && typeof resObj.code === "string") {
          code = resObj.code as ErrorCode;
        } else if (status === HttpStatus.BAD_REQUEST) {
          code = ErrorCode.VALIDATION_ERROR;
        } else if (status === HttpStatus.NOT_FOUND) {
          code = ErrorCode.NOT_FOUND;
        } else if (status === HttpStatus.FORBIDDEN) {
          code = ErrorCode.FORBIDDEN;
        } else if (status === HttpStatus.UNAUTHORIZED) {
          code = ErrorCode.UNAUTHORIZED;
        } else if (status === HttpStatus.CONFLICT) {
          code = ErrorCode.CONFLICT;
        }
        details = resObj.details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const requestId = (request.headers["x-request-id"] as string) || undefined;

    response.status(status).json({
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        ...(requestId ? { requestId } : {}),
      },
    });
  }
}
