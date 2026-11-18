import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
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
  VENUE_LAYOUT_MODEL,
} from "../src/database/database.tokens";

jest.setTimeout(30000);

describe("Auth & RBAC API (e2e - Supertest)", () => {
  let app: INestApplication;

  // In-memory user storage
  const usersStore = new Map<string, any>();

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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue({
        isInitialized: true,
        destroy: jest.fn(),
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
      .overrideProvider(USER_REPOSITORY)
      .useValue(mockUserRepo)
      .overrideProvider(VENUE_LAYOUT_MODEL)
      .useValue({ findById: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
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
  });

  describe("POST /api/v1/auth/register", () => {
    it("should successfully register a customer, return JWT tokens, and store hashed password", async () => {
      const payload = {
        email: "alice@example.com",
        password: "SecurePassword123!",
        firstName: "Alice",
        lastName: "Smith",
        role: UserRole.CUSTOMER,
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
      expect(res.body.user.password).toBeUndefined();

      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe("string");
      expect(res.body.refreshToken).toBeDefined();
      expect(typeof res.body.refreshToken).toBe("string");

      // Verify user in store
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

    it("should reject registration with 400 Bad Request on invalid payload", async () => {
      const payload = {
        email: "not-an-email",
        password: "short",
        firstName: "",
        lastName: "",
      };

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(payload)
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post("/api/v1/auth/register").send({
        email: "carol@example.com",
        password: "CarolPassword123!",
        firstName: "Carol",
        lastName: "Danvers",
        role: UserRole.CUSTOMER,
      });
    });

    it("should successfully log in with valid credentials and return access + refresh tokens", async () => {
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
      expect(res.body.refreshToken).toBeDefined();
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

    it("should return 401 Unauthorized if email is not found", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: "unknown@example.com",
          password: "Password123!",
        })
        .expect(401);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    });
  });

  describe("RBAC & Guards (JwtAuthGuard & RolesGuard)", () => {
    let customerToken: string;
    let adminToken: string;

    beforeEach(async () => {
      const customerRes = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "customer@example.com",
          password: "CustomerPass123!",
          firstName: "Reg",
          lastName: "Customer",
          role: UserRole.CUSTOMER,
        });
      customerToken = customerRes.body.accessToken;

      const adminRes = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "admin@example.com",
          password: "AdminPass123!",
          firstName: "Super",
          lastName: "Admin",
          role: UserRole.ADMIN,
        });
      adminToken = adminRes.body.accessToken;
    });

    it("GET /api/v1/auth/me - should succeed with valid JWT Bearer token", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("customer@example.com");
      expect(res.body.user.role).toBe(UserRole.CUSTOMER);
    });

    it("GET /api/v1/auth/me - should return 401 Unauthorized when Bearer token is missing", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .expect(401);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it("GET /api/v1/auth/admin-only - should return 403 Forbidden when CUSTOMER attempts to access ADMIN route", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/admin-only")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });

    it("GET /api/v1/auth/admin-only - should return 200 OK when ADMIN accesses ADMIN route", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/admin-only")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.message).toBe("Admin access granted");
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe(UserRole.ADMIN);
    });
  });
});
