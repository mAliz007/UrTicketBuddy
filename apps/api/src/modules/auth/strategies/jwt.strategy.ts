import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { loadEnv } from "@urticketbuddy/config";
import { ErrorCode } from "@urticketbuddy/contracts";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type?: "access" | "refresh";
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    const env = loadEnv();
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: "Invalid token payload",
      });
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
