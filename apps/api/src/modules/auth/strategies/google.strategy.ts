import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from "passport-google-oauth20";
import { loadEnv } from "@urticketbuddy/config";
import type { User } from "@urticketbuddy/db";
import { AuthService } from "../auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly authService: AuthService) {
    const env = loadEnv();
    super({
      clientID:
        process.env.GOOGLE_CLIENT_ID ||
        "mock-google-client-id.apps.googleusercontent.com",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret",
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        `http://localhost:${env.API_PORT}/api/v1/auth/google/callback`,
      scope: ["email", "profile"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<User> {
    const email = profile.emails?.[0]?.value;
    const firstName =
      profile.name?.givenName || profile.displayName || "Google";
    const lastName = profile.name?.familyName || "User";

    const user = await this.authService.findOrCreateGoogleUser({
      email,
      firstName,
      lastName,
    });

    return user;
  }
}
