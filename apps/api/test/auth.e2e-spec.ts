import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import cookieParser from "cookie-parser";
import { loadEnv } from "@urticketbuddy/config";
import { ErrorCode, UserRole } from "@urticketbuddy/contracts";
import { AppModule } from "../src/app.module";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  DATA_SOURCE,
  MONGO_CONNECTION,
  VENUE_REPOSITORY,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  ORDER_REPOSITORY,
  ORDER_ITEM_REPOSITORY,
  VENUE_LAYOUT_MODEL,
} from "../src/database/database.tokens";

jest.setTimeout(30000);

describe("Auth & RBAC API (e2e - Supertest)", () => {
  let app: INestApplication;

  // In-memory user and token storage
  const usersStore = new Map<string, any>();
  const refreshTokensStore = new Map<string, any>();

  const mockUserRepo = {
    create: jest.fn((dto: any) => ({
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...dto,
    })),
    save: jest.fn(async (entity: any) => {
      usersStore.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      if (where?.id) {
        return usersStore.get(where.id) || null;
      }
      if (where?.email) {
        for (const user of usersStore.values()) {
          if (user.email === where.email) {
            return user;
          }
        }
      }
      return null;
    }),
  };

  const mockRefreshTokenRepo = {
    create: jest.fn((dto: any) => ({
      id: `rt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...dto,
    })),
    save: jest.fn(async (entity: any) => {
      refreshTokensStore.set(entity.tokenHash, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      if (where?.tokenHash) {
        return refreshTokensStore.get(where.tokenHash) || null;
      }
      return null;
    }),
    update: jest.fn(async (criteria: any, partial: any) => {
      if (criteria?.familyId) {
        for (const token of refreshTokensStore.values()) {
          if (token.familyId === criteria.familyId) {
            token.isRevoked = partial.isRevoked;
          }
        }
      }
      if (criteria?.tokenHash) {
        const token = refreshTokensStore.get(criteria.tokenHash);
        if (token) token.isRevoked = partial.isRevoked;
      }
      return { affected: 1 };
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue({
        isInitialized: true,
        destroy: jest.fn(),
        getRepository: jest.fn(() => ({
          create: jest.fn((dto: any) => dto),
          save: jest.fn(async (entity: any) => entity),
          findOne: jest.fn(),
          find: jest.fn(),
          delete: jest.fn(),
          update: jest.fn(),
        })),
      })
      .overrideProvider(MONGO_CONNECTION)
      .useValue({
        readyState: 1,
      })
      .overrideProvider(VENUE_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(EVENT_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(ORDER_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(ORDER_ITEM_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(USER_REPOSITORY)
      .useValue(mockUserRepo)
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(mockRefreshTokenRepo)
      .overrideProvider(VENUE_LAYOUT_MODEL)
      .useValue({ findById: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    usersStore.clear();
    refreshTokensStore.clear();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should successfully register a customer, return JWT tokens, and store hashed password", async () => {
      const payload = {
        email: "alice@example.com",
        password: "SecurePassword123!",
        firstName: "Alice",
        lastName: "Smith",
      };

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(payload)
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.email).toBe("alice@example.com");
      expect(res.body.user.firstName).toBe("Alice");
      expect(res.body.user.lastName).toBe("Smith");
      expect(res.body.user.role).toBe(UserRole.CUSTOMER);
      expect(res.body.user.passwordHash).toBeUndefined();

      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe("string");

      // Verify Set-Cookie header contains refreshToken
      const rawCookies = res.headers["set-cookie"];
      const cookies = Array.isArray(rawCookies)
        ? rawCookies
        : rawCookies
          ? [rawCookies]
          : [];
      const hasRefreshCookie = cookies.some((c: string) =>
        c.startsWith("refreshToken="),
      );
      expect(hasRefreshCookie).toBe(true);

      // Verify password hashed
      const stored = usersStore.get(res.body.user.id);
      expect(stored).toBeDefined();
      expect(stored.passwordHash).not.toBe("SecurePassword123!");
      expect(stored.passwordHash.startsWith("$2")).toBe(true);
    });

    it("should reject registration with 409 Conflict if email is already taken", async () => {
      const payload = {
        email: "bob@example.com",
        password: "Password123!",
        firstName: "Bob",
        lastName: "Jones",
      };

      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(payload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(payload)
        .expect(409);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.EMAIL_ALREADY_EXISTS);
    });

    it("should reject self-registration with role ADMIN or ORGANIZER with 422", async () => {
      const adminAttempt = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "escalate-admin@example.com",
          password: "Password123!",
          firstName: "Escalate",
          lastName: "Admin",
          role: UserRole.ADMIN,
        })
        .expect(422);

      expect(adminAttempt.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);

      const organizerAttempt = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "escalate-org@example.com",
          password: "Password123!",
          firstName: "Escalate",
          lastName: "Org",
          role: UserRole.ORGANIZER,
        })
        .expect(422);

      expect(organizerAttempt.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(
        Array.from(usersStore.values()).some(
          (u) =>
            u.email === "escalate-admin@example.com" ||
            u.email === "escalate-org@example.com",
        ),
      ).toBe(false);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post("/api/v1/auth/register").send({
        email: "carol@example.com",
        password: "CarolPassword123!",
        firstName: "Carol",
        lastName: "Danvers",
      });
    });

    it("should successfully log in with valid credentials and return access token + cookie", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: "carol@example.com",
          password: "CarolPassword123!",
        })
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("carol@example.com");
      expect(res.body.accessToken).toBeDefined();

      const rawCookies = res.headers["set-cookie"];
      const cookies = Array.isArray(rawCookies)
        ? rawCookies
        : rawCookies
          ? [rawCookies]
          : [];
      expect(cookies.some((c: string) => c.startsWith("refreshToken="))).toBe(
        true,
      );
    });

    it("should return 401 Unauthorized if password is incorrect", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: "carol@example.com",
          password: "WrongPassword!",
        })
        .expect(401);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    });

    it("should include organizerTenantId claim in JWT issued at login for ORGANIZER and GATE_STAFF", async () => {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("TenantPass123!", 10);
      const orgTenantId = "11111111-1111-4111-8111-111111111111";

      usersStore.set("usr-org-login", {
        id: "usr-org-login",
        email: "org-login@example.com",
        passwordHash: hash,
        firstName: "Org",
        lastName: "Login",
        role: UserRole.ORGANIZER,
        organizerTenantId: orgTenantId,
        isSuspended: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      usersStore.set("usr-staff-login", {
        id: "usr-staff-login",
        email: "staff-login@example.com",
        passwordHash: hash,
        firstName: "Staff",
        lastName: "Login",
        role: UserRole.GATE_STAFF,
        organizerTenantId: orgTenantId,
        isSuspended: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const orgRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "org-login@example.com", password: "TenantPass123!" })
        .expect(200);
      const orgClaims = JSON.parse(
        Buffer.from(
          orgRes.body.accessToken.split(".")[1],
          "base64url",
        ).toString("utf8"),
      );
      expect(orgClaims.organizerTenantId).toBe(orgTenantId);

      const staffRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "staff-login@example.com", password: "TenantPass123!" })
        .expect(200);
      const staffClaims = JSON.parse(
        Buffer.from(
          staffRes.body.accessToken.split(".")[1],
          "base64url",
        ).toString("utf8"),
      );
      expect(staffClaims.organizerTenantId).toBe(orgTenantId);
    });
  });

  describe("Token Rotation & Reuse Detection (POST /api/v1/auth/refresh)", () => {
    let originalCookie: string;

    beforeEach(async () => {
      const registerRes = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "rotator@example.com",
          password: "Password123!",
          firstName: "Rotate",
          lastName: "User",
        });

      const rawCookies = registerRes.headers["set-cookie"];
      const cookies = Array.isArray(rawCookies)
        ? rawCookies
        : rawCookies
          ? [rawCookies]
          : [];
      const cookie = cookies.find((c: string) => c.startsWith("refreshToken="));
      originalCookie = cookie ? cookie.split(";")[0] : "";
    });

    it("should rotate refresh token and issue new token pair", async () => {
      const refreshRes = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", originalCookie)
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();
      const rawNewCookies = refreshRes.headers["set-cookie"];
      const newCookies = Array.isArray(rawNewCookies)
        ? rawNewCookies
        : rawNewCookies
          ? [rawNewCookies]
          : [];
      expect(
        newCookies.some((c: string) => c.startsWith("refreshToken=")),
      ).toBe(true);
    });

    it("should detect token reuse and revoke token family on replay of old token", async () => {
      // First refresh succeeds and rotates the token
      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", originalCookie)
        .expect(200);

      // Replaying the old (now revoked) cookie triggers reuse detection
      const replayRes = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", originalCookie)
        .expect(401);

      expect(replayRes.body.error).toBeDefined();
      expect(replayRes.body.error.code).toBe(ErrorCode.INVALID_REFRESH_TOKEN);
    });
  });

  describe("Gate Staff Provisioning (POST /api/v1/organizer/gate-staff)", () => {
    let customerToken: string;
    let organizerToken: string;
    const organizerTenantId = "99999999-9999-4999-8999-999999999999";

    beforeEach(async () => {
      const env = loadEnv();
      const jwtService = new JwtService({ secret: env.JWT_SECRET });

      customerToken = jwtService.sign({
        sub: "usr-reg-customer",
        email: "regular@example.com",
        role: UserRole.CUSTOMER,
      });

      organizerToken = jwtService.sign({
        sub: "usr-org-seeded",
        email: "organizer@example.com",
        role: UserRole.ORGANIZER,
        organizerTenantId,
      });
    });

    it("should reject customer attempts to provision gate staff with 403 Forbidden", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/organizer/gate-staff")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          email: "staff1@example.com",
          password: "Password123!",
          firstName: "Gate",
          lastName: "Staff",
        })
        .expect(403);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });

    it("should allow organizer to provision gate staff bound to their tenant", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/organizer/gate-staff")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          email: "scanner@example.com",
          password: "ScannerPass123!",
          firstName: "Scanner",
          lastName: "One",
        })
        .expect(201);

      expect(res.body.email).toBe("scanner@example.com");
      expect(res.body.role).toBe(UserRole.GATE_STAFF);
      expect(res.body.organizerTenantId).toBe(organizerTenantId);
    });

    it("should reject organizer provisioning gate staff for another tenant", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/organizer/gate-staff")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          email: "cross-tenant-staff@example.com",
          password: "ScannerPass123!",
          firstName: "Cross",
          lastName: "Tenant",
          organizerTenantId: "88888888-8888-4888-8888-888888888888",
        })
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe("User Profile Management (GET & PUT /api/v1/users/me/profile)", () => {
    let userToken: string;

    beforeEach(async () => {
      const regRes = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "profileuser@example.com",
          password: "Password123!",
          firstName: "OriginalFirst",
          lastName: "OriginalLast",
        });
      userToken = regRes.body.accessToken;
    });

    it("GET /api/v1/users/me/profile - should return current user profile", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/users/me/profile")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.email).toBe("profileuser@example.com");
      expect(res.body.firstName).toBe("OriginalFirst");
      expect(res.body.lastName).toBe("OriginalLast");
    });

    it("PUT /api/v1/users/me/profile - should update profile attributes", async () => {
      const res = await request(app.getHttpServer())
        .put("/api/v1/users/me/profile")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          firstName: "UpdatedFirst",
          lastName: "UpdatedLast",
        })
        .expect(200);

      expect(res.body.firstName).toBe("UpdatedFirst");
      expect(res.body.lastName).toBe("UpdatedLast");
    });
  });

  describe("RBAC & Guards Matrix", () => {
    let adminToken: string;
    let customerToken: string;

    beforeEach(async () => {
      const env = loadEnv();
      const jwtService = new JwtService({ secret: env.JWT_SECRET });

      adminToken = jwtService.sign({
        sub: "usr-admin-seeded",
        email: "superadmin@example.com",
        role: UserRole.ADMIN,
      });

      customerToken = jwtService.sign({
        sub: "usr-reg-two",
        email: "regular2@example.com",
        role: UserRole.CUSTOMER,
      });
    });

    it("should allow ADMIN to access admin-only route with 200 OK", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/admin-only")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.message).toBe("Admin access granted");
    });

    it("should reject CUSTOMER on admin-only route with 403 Forbidden", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/admin-only")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });
});
