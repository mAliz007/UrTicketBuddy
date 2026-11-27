import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../../database/database.tokens";
import { AuthController } from "./auth.controller";
import { OrganizerController } from "./organizer.controller";
import { UsersController } from "../users/users.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { OwnershipGuard } from "./guards/ownership.guard";
import { RedisThrottlerStorageService } from "./throttler/redis-throttler.storage";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [
          {
            ttl: 60000,
            limit: 100,
          },
        ],
        storage: new RedisThrottlerStorageService(redis),
      }),
    }),
  ],
  controllers: [AuthController, OrganizerController, UsersController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    JwtAuthGuard,
    RolesGuard,
    OwnershipGuard,
    RedisThrottlerStorageService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    JwtAuthGuard,
    RolesGuard,
    OwnershipGuard,
    RedisThrottlerStorageService,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
