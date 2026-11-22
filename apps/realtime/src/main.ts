import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadEnv } from "@urticketbuddy/config";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const env = loadEnv();
  const logger = new Logger("RealtimeBootstrap");
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api/v1");
  app.enableCors();

  const port = env.REALTIME_PORT || 3001;
  await app.listen(port);
  logger.log(`Realtime service running on port ${port} under prefix /api/v1`);
}

bootstrap();
