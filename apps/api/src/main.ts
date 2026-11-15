import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadEnv } from "@urticketbuddy/config";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const env = loadEnv();
  const logger = new Logger("ApiBootstrap");
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api/v1");
  app.enableCors();

  const port = env.API_PORT || 3000;
  await app.listen(port);
  logger.log(`API application running on port ${port} under prefix /api/v1`);
}

bootstrap();
