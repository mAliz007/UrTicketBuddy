import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { loadEnv } from "@urticketbuddy/config";
import { Logger } from "@nestjs/common";
import { GlobalHttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LogRedactionInterceptor } from "./common/interceptors/log-redaction.interceptor";

async function bootstrap() {
  const env = loadEnv();
  const logger = new Logger("ApiBootstrap");
  const app = await NestFactory.create(AppModule);

  // Security HTTP Headers with Helmet
  app.use(helmet());

  // Strict Request Body Limit (100kb)
  app.use(json({ limit: "100kb" }));
  app.use(urlencoded({ extended: true, limit: "100kb" }));

  app.use(cookieParser());

  // Global exception filter and log redaction interceptor
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalInterceptors(new LogRedactionInterceptor());

  // Allow root /health and /media to resolve under global prefix /api/v1
  app.use((req: any, _res: any, next: any) => {
    if (req.url === "/health" || req.url === "/health/") {
      req.url = "/api/v1/health";
    } else if (req.url.startsWith("/media/")) {
      req.url = `/api/v1${req.url}`;
    }
    next();
  });

  app.setGlobalPrefix("api/v1");

  // Strict CORS allowlist loaded from environment config (CORS_ORIGINS)
  const allowedOrigins = (env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow non-browser requests (mobile apps, server-to-server, curl)
      if (!origin) {
        return callback(null, true);
      }
      if (
        allowedOrigins.includes(origin) ||
        (env.NODE_ENV !== "production" && origin.includes("localhost"))
      ) {
        return callback(null, true);
      }
      return callback(
        new Error(`CORS policy violation: Origin '${origin}' is not allowed`),
        false,
      );
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Idempotency-Key",
      "X-Refresh-Token",
      "x-request-id",
    ],
  });

  const port = env.API_PORT || 3000;
  await app.listen(port);
  logger.log(
    `API application running on port ${port} under prefix /api/v1 and /health`,
  );
}

bootstrap();
