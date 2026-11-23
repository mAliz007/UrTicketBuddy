import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadEnv } from "@urticketbuddy/config";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const env = loadEnv();
  const logger = new Logger("WorkerBootstrap");
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  // Allow root /health to resolve to /api/v1/health
  app.use((req: any, _res: any, next: any) => {
    if (req.url === "/health" || req.url === "/health/") {
      req.url = "/api/v1/health";
    }
    next();
  });

  app.setGlobalPrefix("api/v1");
  app.enableCors();

  const port = env.WORKER_PORT || 3002;
  await app.listen(port);
  logger.log(
    `Worker service running (health on port ${port} under /api/v1 and /health)`,
  );
}

bootstrap();
