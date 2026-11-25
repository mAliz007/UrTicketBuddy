import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "token",
  "qrtoken",
  "qrpayload",
  "secret",
  "clientsecret",
  "mastersecret",
  "masterticketsecret",
  "hmac",
  "seed",
  "key",
]);

export function isSensitiveField(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_]/g, ""));
}

export function redactSensitiveData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  if (data instanceof Date || data instanceof RegExp) {
    return data;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveField(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted as T;
}

export function sanitizeUrl(rawUrl: string): string {
  try {
    const qIndex = rawUrl.indexOf("?");
    if (qIndex === -1) return rawUrl;

    const path = rawUrl.substring(0, qIndex);
    const queryString = rawUrl.substring(qIndex + 1);
    const params = new URLSearchParams(queryString);

    for (const key of Array.from(params.keys())) {
      if (isSensitiveField(key)) {
        params.set(key, "[REDACTED]");
      }
    }
    return `${path}?${params.toString()}`;
  } catch {
    return rawUrl;
  }
}

@Injectable()
export class LogRedactionInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const method = req?.method || "GET";
    const rawUrl = req?.originalUrl || req?.url || "/";
    const url = sanitizeUrl(rawUrl);
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (_responseBody) => {
          const duration = Date.now() - startTime;
          const statusCode = res?.statusCode || 200;
          this.logger.log(`[${method}] ${url} ${statusCode} - ${duration}ms`);
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err?.status || res?.statusCode || 500;
          const safeError =
            typeof err?.message === "string"
              ? err.message.replace(
                  /Bearer\s+[A-Za-z0-9._-]+/gi,
                  "Bearer [REDACTED]",
                )
              : "Internal Error";
          this.logger.warn(
            `[${method}] ${url} ${statusCode} - ${duration}ms - Error: ${safeError}`,
          );
        },
      }),
    );
  }
}
