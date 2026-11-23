import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { loadEnv } from "@urticketbuddy/config";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const env = loadEnv();
  const logger = new Logger("ApiBootstrap");
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

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
  app.enableCors({
    origin: true,
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
    ],
  });

  const port = env.API_PORT || 3000;
  await app.listen(port);
  logger.log(
    `API application running on port ${port} under prefix /api/v1 and /health`,
  );
}

bootstrap();
