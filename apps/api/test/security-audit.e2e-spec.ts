import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { Reflector, ModulesContainer } from "@nestjs/core";
import request from "supertest";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { JwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  LogRedactionInterceptor,
  redactSensitiveData,
} from "../src/common/interceptors/log-redaction.interceptor";
import { OwnershipGuard } from "../src/common/guards/ownership.guard";
import { IS_PUBLIC_KEY } from "../src/modules/auth/decorators/public.decorator";
import { ROLES_KEY } from "../src/modules/auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../src/modules/auth/guards/jwt-auth.guard";
import { RolesGuard } from "../src/modules/auth/guards/roles.guard";
import { loadEnv } from "@urticketbuddy/config";
import {
  UserRole,
  ErrorCode,
  TicketStatus,
  OrderStatus,
  ResaleListingStatus,
} from "@urticketbuddy/contracts";
import {
  DATA_SOURCE,
  MONGO_CONNECTION,
  VENUE_REPOSITORY,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  ORDER_REPOSITORY,
  ORDER_ITEM_REPOSITORY,
  TICKET_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  PLATFORM_SETTING_REPOSITORY,
  AUDIT_LOG_REPOSITORY,
  RESALE_LISTING_REPOSITORY,
  LEDGER_ENTRY_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
  VENUE_LAYOUT_MODEL,
} from "../src/database/database.tokens";
import { CHECKOUT_REDIS_CLIENT } from "../src/modules/checkout/checkout.tokens";

jest.setTimeout(30000);

describe("Security Audit, Route Authorization Matrix & Tenant Isolation (e2e)", () => {
  let app: INestApplication;
  let reflector: Reflector;
  let modulesContainer: ModulesContainer;
  let jwtService: JwtService;

  const env = loadEnv();

  // Test Personas (Valid UUIDv4 format)
  const adminId = "a0000000-0000-4000-a000-000000000001";
  const organizer1Id = "10000000-0000-4000-a000-000000000001";
  const organizer2Id = "20000000-0000-4000-a000-000000000002";
  const gateStaffId = "30000000-0000-4000-a000-000000000001";
  const customerId = "40000000-0000-4000-a000-000000000001";
  const otherCustomerId = "50000000-0000-4000-a000-000000000002";

  let adminToken: string;
  let organizer1Token: string;
  let organizer2Token: string;
  let gateStaffToken: string;
  let customerToken: string;
  let otherCustomerToken: string;

  // In-memory data store for E2E isolation
  const usersStore = new Map<string, any>();
  const refreshTokensStore = new Map<string, any>();
  const ticketsStore = new Map<string, any>();
  const eventsStore = new Map<string, any>();
  const ordersStore = new Map<string, any>();
  const resaleListingsStore = new Map<string, any>();
  const auditLogsStore: any[] = [];
  const platformSettingsStore = new Map<string, any>();

  const event1Id = "e1000000-0000-4000-a000-000000000001";
  const event2Id = "e2000000-0000-4000-a000-000000000002";
  const ticket1Id = "71000000-0000-4000-a000-000000000001";
  const ticket2Id = "72000000-0000-4000-a000-000000000002";
  const listing1Id = "81000000-0000-4000-a000-000000000001";

  beforeAll(async () => {
    jwtService = new JwtService({ secret: env.JWT_SECRET });

    adminToken = jwtService.sign({
      sub: adminId,
      id: adminId,
      email: "admin@urticketbuddy.local",
      role: UserRole.ADMIN,
    });

    organizer1Token = jwtService.sign({
      sub: organizer1Id,
      id: organizer1Id,
      email: "org1@urticketbuddy.local",
      role: UserRole.ORGANIZER,
      organizerTenantId: organizer1Id,
    });

    organizer2Token = jwtService.sign({
      sub: organizer2Id,
      id: organizer2Id,
      email: "org2@urticketbuddy.local",
      role: UserRole.ORGANIZER,
      organizerTenantId: organizer2Id,
    });

    gateStaffToken = jwtService.sign({
      sub: gateStaffId,
      id: gateStaffId,
      email: "gatestaff@urticketbuddy.local",
      role: UserRole.GATE_STAFF,
      organizerTenantId: organizer1Id,
    });

    customerToken = jwtService.sign({
      sub: customerId,
      id: customerId,
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
    });

    otherCustomerToken = jwtService.sign({
      sub: otherCustomerId,
      id: otherCustomerId,
      email: "other@example.com",
      role: UserRole.CUSTOMER,
    });

    // Seed test users
    usersStore.set(adminId, {
      id: adminId,
      email: "admin@urticketbuddy.local",
      role: UserRole.ADMIN,
      isSuspended: false,
    });
    usersStore.set(organizer1Id, {
      id: organizer1Id,
      email: "org1@urticketbuddy.local",
      role: UserRole.ORGANIZER,
      organizerTenantId: organizer1Id,
      isSuspended: false,
    });
    usersStore.set(customerId, {
      id: customerId,
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
      isSuspended: false,
    });

    // Seed test events
    eventsStore.set(event1Id, {
      id: event1Id,
      title: "Organizer 1 Mega Fest",
      organizerId: organizer1Id,
      startTime: new Date(Date.now() + 86400000),
    });
    eventsStore.set(event2Id, {
      id: event2Id,
      title: "Organizer 2 Indie Concert",
      organizerId: organizer2Id,
      startTime: new Date(Date.now() + 86400000),
    });

    // Seed test tickets
    ticketsStore.set(ticket1Id, {
      id: ticket1Id,
      eventId: event1Id,
      ownerId: customerId,
      status: TicketStatus.ISSUED,
      seedVersion: 1,
      tierId: "tier-1",
      faceValueMinor: 5000,
      event: eventsStore.get(event1Id),
    });
    ticketsStore.set(ticket2Id, {
      id: ticket2Id,
      eventId: event2Id,
      ownerId: otherCustomerId,
      status: TicketStatus.ISSUED,
      seedVersion: 1,
      tierId: "tier-2",
      faceValueMinor: 5000,
      event: eventsStore.get(event2Id),
    });

    // Seed resale listing
    resaleListingsStore.set(listing1Id, {
      id: listing1Id,
      ticketId: ticket1Id,
      eventId: event1Id,
      sellerId: customerId,
      askingPriceMinor: 5000,
      status: ResaleListingStatus.ACTIVE,
      ticket: ticketsStore.get(ticket1Id),
      event: eventsStore.get(event1Id),
    });

    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      publish: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };

    const mockRedisScripts = {
      holdSeats: jest
        .fn()
        .mockResolvedValue({ success: true, expiresAt: Date.now() + 600000 }),
      confirmSold: jest.fn().mockResolvedValue({ success: true, code: "OK" }),
      unsellSeats: jest.fn().mockResolvedValue({ success: true }),
      getCounts: jest.fn().mockResolvedValue({ held: 0, sold: 10 }),
    };

    const mockUserRepo = {
      create: jest.fn((dto: any) => ({
        ...dto,
        id: dto.id || `usr-${Date.now()}`,
      })),
      save: jest.fn(async (u: any) => {
        usersStore.set(u.id, { ...u });
        return { ...u };
      }),
      findOne: jest.fn(async ({ where }: any) => {
        if (where?.id) return usersStore.get(where.id) || null;
        if (where?.email) {
          for (const u of usersStore.values()) {
            if (u.email === where.email) return u;
          }
        }
        return null;
      }),
      find: jest.fn(async () => Array.from(usersStore.values())),
    };

    const mockRefreshTokenRepo = {
      create: jest.fn((dto: any) => ({ ...dto, id: `rt-${Date.now()}` })),
      save: jest.fn(async (t: any) => {
        refreshTokensStore.set(t.tokenHash, { ...t });
        return { ...t };
      }),
      findOne: jest.fn(async ({ where }: any) => {
        if (where?.tokenHash)
          return refreshTokensStore.get(where.tokenHash) || null;
        return null;
      }),
      update: jest.fn(async (crit: any, partial: any) => {
        if (crit?.familyId) {
          for (const t of refreshTokensStore.values()) {
            if (t.familyId === crit.familyId) {
              t.isRevoked = partial.isRevoked ?? t.isRevoked;
            }
          }
        }
      }),
    };

    const mockTicketRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        const t = ticketsStore.get(where.id);
        if (!t) return null;
        return {
          ...t,
          event: eventsStore.get(t.eventId),
        };
      }),
      find: jest.fn(async ({ where }: any) => {
        const results: any[] = [];
        for (const t of ticketsStore.values()) {
          if (where?.ownerId && t.ownerId !== where.ownerId) continue;
          if (where?.eventId && t.eventId !== where.eventId) continue;
          results.push({ ...t });
        }
        return results;
      }),
      count: jest.fn(async () => 10),
      increment: jest.fn(async ({ id }: any, field: string, amount: number) => {
        const t = ticketsStore.get(id);
        if (t) {
          t[field] = (t[field] || 0) + amount;
        }
      }),
      save: jest.fn(async (t: any) => {
        ticketsStore.set(t.id, { ...t });
        return { ...t };
      }),
    };

    const mockEventRepo = {
      findOne: jest.fn(
        async ({ where }: any) => eventsStore.get(where.id) || null,
      ),
      find: jest.fn(async () => Array.from(eventsStore.values())),
      save: jest.fn(async (e: any) => {
        eventsStore.set(e.id, { ...e });
        return { ...e };
      }),
      create: jest.fn((dto: any) => ({ ...dto, id: `e-${Date.now()}` })),
    };

    const mockVenueRepo = {
      findOne: jest.fn(async () => ({ id: "v1", name: "Arena 1" })),
      find: jest.fn(async () => [{ id: "v1", name: "Arena 1" }]),
      save: jest.fn(async (v: any) => ({
        ...v,
        id: v.id || "v1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      create: jest.fn((dto: any) => ({
        ...dto,
        id: "v1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };

    const MockVenueLayoutModel: any = jest
      .fn()
      .mockImplementation((payload: any) => ({
        _id: `layout-${Date.now()}`,
        ...payload,
        save: async () => ({
          _id: `layout-${Date.now()}`,
          ...payload,
        }),
      }));
    MockVenueLayoutModel.findById = jest.fn((id: string) => ({
      lean: async () => ({
        _id: id,
        schemaVersion: 1,
        name: "Test Layout",
        dimensions: { width: 1000, height: 800 },
        sections: [
          {
            type: "grid",
            id: "SEC-1",
            name: "General",
            origin: { x: 10, y: 10 },
            rows: 5,
            columns: 10,
            seatWidth: 20,
            gapX: 5,
            gapY: 5,
            staggerOffset: 0,
            aisleColumns: [],
            aisleWidth: 0,
          },
        ],
      }),
    }));

    const mockEventSeatRepo = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (s: any) => s),
      count: jest.fn(async () => 100),
      insert: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({ affected: 1 })),
    };

    const mockOrderRepo = {
      findOne: jest.fn(
        async ({ where }: any) => ordersStore.get(where.id) || null,
      ),
      find: jest.fn(async () => Array.from(ordersStore.values())),
      save: jest.fn(async (o: any) => {
        ordersStore.set(o.id, { ...o });
        return { ...o };
      }),
      create: jest.fn((dto: any) => ({ ...dto, id: `ord-${Date.now()}` })),
    };

    const mockOrderItemRepo = {
      find: jest.fn(async () => []),
      save: jest.fn(async (i: any) => i),
      create: jest.fn((dto: any) => dto),
    };

    const mockGateScanRepo = {
      find: jest.fn(async () => []),
      save: jest.fn(async (g: any) => g),
      create: jest.fn((dto: any) => dto),
    };

    const mockPlatformSettingRepo = {
      findOne: jest.fn(
        async ({ where }: any) => platformSettingsStore.get(where.key) || null,
      ),
      save: jest.fn(async (s: any) => {
        platformSettingsStore.set(s.key, s);
        return s;
      }),
      create: jest.fn((dto: any) => dto),
    };

    const mockAuditLogRepo = {
      create: jest.fn((dto: any) => ({
        ...dto,
        id: `audit-${Date.now()}`,
        createdAt: new Date(),
      })),
      save: jest.fn(async (log: any) => {
        auditLogsStore.push(log);
        return log;
      }),
      findAndCount: jest.fn(async () => [
        auditLogsStore,
        auditLogsStore.length,
      ]),
    };

    const mockResaleListingRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        const l = resaleListingsStore.get(where.id);
        if (!l) return null;
        return {
          ...l,
          event: eventsStore.get(l.eventId),
          ticket: ticketsStore.get(l.ticketId),
        };
      }),
      find: jest.fn(async () => Array.from(resaleListingsStore.values())),
      save: jest.fn(async (l: any) => {
        resaleListingsStore.set(l.id, { ...l });
        return { ...l };
      }),
      create: jest.fn((dto: any) => ({ ...dto, id: `l-${Date.now()}` })),
    };

    const mockLedgerEntryRepo = {
      create: jest.fn((dto: any) => ({ ...dto, id: `led-${Date.now()}` })),
      save: jest.fn(async (entries: any) => entries),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue({
        isInitialized: true,
        destroy: jest.fn(),
        getRepository: jest.fn((entity: any) => {
          if (entity.name === "User") return mockUserRepo;
          if (entity.name === "Ticket") return mockTicketRepo;
          if (entity.name === "Event") return mockEventRepo;
          if (entity.name === "Order") return mockOrderRepo;
          if (entity.name === "ResaleListing") return mockResaleListingRepo;
          return {
            create: jest.fn((dto: any) => dto),
            save: jest.fn(async (e: any) => e),
            findOne: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
          };
        }),
        transaction: jest.fn(async (cb: (mgr: any) => Promise<any>) =>
          cb({
            create: jest.fn((_, dto: any) => dto),
            save: jest.fn(async (_, entity: any) => entity),
            findOne: jest.fn(async (entity: any, opts: any) => {
              if (entity.name === "ResaleListing")
                return resaleListingsStore.get(opts.where.id) || null;
              if (entity.name === "Ticket")
                return ticketsStore.get(opts.where.id) || null;
              return null;
            }),
          }),
        ),
      })
      .overrideProvider(USER_REPOSITORY)
      .useValue(mockUserRepo)
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(mockRefreshTokenRepo)
      .overrideProvider(TICKET_REPOSITORY)
      .useValue(mockTicketRepo)
      .overrideProvider(EVENT_REPOSITORY)
      .useValue(mockEventRepo)
      .overrideProvider(VENUE_REPOSITORY)
      .useValue(mockVenueRepo)
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue(mockEventSeatRepo)
      .overrideProvider(ORDER_REPOSITORY)
      .useValue(mockOrderRepo)
      .overrideProvider(ORDER_ITEM_REPOSITORY)
      .useValue(mockOrderItemRepo)
      .overrideProvider(GATE_SCAN_REPOSITORY)
      .useValue(mockGateScanRepo)
      .overrideProvider(PLATFORM_SETTING_REPOSITORY)
      .useValue(mockPlatformSettingRepo)
      .overrideProvider(AUDIT_LOG_REPOSITORY)
      .useValue(mockAuditLogRepo)
      .overrideProvider(RESALE_LISTING_REPOSITORY)
      .useValue(mockResaleListingRepo)
      .overrideProvider(LEDGER_ENTRY_REPOSITORY)
      .useValue(mockLedgerEntryRepo)
      .overrideProvider(MONGO_CONNECTION)
      .useValue({ readyState: 1, model: jest.fn() })
      .overrideProvider(VENUE_LAYOUT_MODEL)
      .useValue(MockVenueLayoutModel)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .overrideProvider(CHECKOUT_REDIS_CLIENT)
      .useValue(mockRedis)
      .overrideProvider(REDIS_SCRIPTS_WRAPPER)
      .useValue(mockRedisScripts)
      .compile();

    reflector = moduleFixture.get<Reflector>(Reflector);
    modulesContainer = moduleFixture.get<ModulesContainer>(ModulesContainer);

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    app.useGlobalInterceptors(new LogRedactionInterceptor());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("1. Route Metadata Audit Scanner", () => {
    it("should programmatically walk all controllers and assert 100% compliance with @Public() or JwtAuthGuard/@Roles", () => {
      let auditedRoutesCount = 0;
      const routeAuditLog: Array<{
        controller: string;
        method: string;
        isPublic: boolean;
        hasJwtGuard: boolean;
        hasRoles: boolean;
      }> = [];

      for (const [_, nestModule] of modulesContainer) {
        for (const [_, controllerWrapper] of nestModule.controllers) {
          const controllerInstance = controllerWrapper.instance;
          const controllerClass = controllerWrapper.metatype;
          if (!controllerClass || !controllerInstance) continue;

          // Controller-level decorators
          const isControllerPublic = Boolean(
            reflector.get<boolean>(IS_PUBLIC_KEY, controllerClass),
          );
          const controllerGuards =
            Reflect.getMetadata("__guards__", controllerClass) || [];
          const controllerRoles =
            reflector.get<(UserRole | string)[]>(ROLES_KEY, controllerClass) ||
            [];

          const controllerHasJwt = controllerGuards.some(
            (g: any) =>
              g === JwtAuthGuard ||
              (typeof g === "function" && g.name === "JwtAuthGuard"),
          );

          const prototype = Object.getPrototypeOf(controllerInstance);
          const propertyNames = Object.getOwnPropertyNames(prototype).filter(
            (p) => p !== "constructor" && typeof prototype[p] === "function",
          );

          for (const methodName of propertyNames) {
            const methodHandler = prototype[methodName];
            const routePath = Reflect.getMetadata("path", methodHandler);
            if (routePath === undefined) continue; // Not an endpoint

            auditedRoutesCount++;

            const isMethodPublic = Boolean(
              reflector.get<boolean>(IS_PUBLIC_KEY, methodHandler),
            );
            const isPublic = isControllerPublic || isMethodPublic;

            const methodGuards =
              Reflect.getMetadata("__guards__", methodHandler) || [];
            const methodRoles =
              reflector.get<(UserRole | string)[]>(ROLES_KEY, methodHandler) ||
              [];

            const hasJwtGuard =
              controllerHasJwt ||
              methodGuards.some(
                (g: any) =>
                  g === JwtAuthGuard ||
                  (typeof g === "function" && g.name === "JwtAuthGuard"),
              );

            const hasRoles =
              controllerRoles.length > 0 || methodRoles.length > 0;

            const isProtectedOrPublic = isPublic || (hasJwtGuard && hasRoles);

            routeAuditLog.push({
              controller: controllerClass.name,
              method: methodName,
              isPublic,
              hasJwtGuard,
              hasRoles,
            });

            expect(isProtectedOrPublic).toBe(true);
          }
        }
      }

      // Assert comprehensive coverage of route registry (@Public or @Roles required on every route)
      expect(auditedRoutesCount).toBeGreaterThanOrEqual(15);
      expect(
        routeAuditLog.every((r) => r.isPublic || (r.hasJwtGuard && r.hasRoles)),
      ).toBe(true);
    });
  });

  describe("2. Role × Route Authorization Matrix Suite", () => {
    describe("Endpoint: GET /api/v1/auth/me", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        const res = await request(app.getHttpServer())
          .get("/api/v1/auth/me")
          .expect(401);
        expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
      });

      it("CUSTOMER -> 200 OK", async () => {
        const res = await request(app.getHttpServer())
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(200);
        expect(res.body.user).toBeDefined();
      });

      it("ORGANIZER -> 200 OK", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${organizer1Token}`)
          .expect(200);
      });

      it("ADMIN -> 200 OK", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe("Endpoint: GET /api/v1/auth/admin-only", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/auth/admin-only")
          .expect(401);
      });

      it("CUSTOMER -> 403 FORBIDDEN", async () => {
        const res = await request(app.getHttpServer())
          .get("/api/v1/auth/admin-only")
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(403);
        expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
      });

      it("GATE_STAFF -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/auth/admin-only")
          .set("Authorization", `Bearer ${gateStaffToken}`)
          .expect(403);
      });

      it("ORGANIZER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/auth/admin-only")
          .set("Authorization", `Bearer ${organizer1Token}`)
          .expect(403);
      });

      it("ADMIN -> 200 OK", async () => {
        const res = await request(app.getHttpServer())
          .get("/api/v1/auth/admin-only")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.message).toBe("Admin access granted");
      });
    });

    describe("Endpoint: POST /api/v1/organizer/gate-staff", () => {
      const payload = {
        email: "newgate@example.com",
        password: "TempPassword123!",
        firstName: "Gate",
        lastName: "Staff",
      };

      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/organizer/gate-staff")
          .send(payload)
          .expect(401);
      });

      it("CUSTOMER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/organizer/gate-staff")
          .set("Authorization", `Bearer ${customerToken}`)
          .send(payload)
          .expect(403);
      });

      it("GATE_STAFF -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/organizer/gate-staff")
          .set("Authorization", `Bearer ${gateStaffToken}`)
          .send(payload)
          .expect(403);
      });

      it("ORGANIZER -> 201 CREATED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/organizer/gate-staff")
          .set("Authorization", `Bearer ${organizer1Token}`)
          .send(payload)
          .expect(201);
      });

      it("ADMIN -> 201 CREATED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/organizer/gate-staff")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ ...payload, email: "newgate-admin@example.com" })
          .expect(201);
      });
    });

    describe("Endpoint: GET /api/v1/users/me/profile", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/users/me/profile")
          .expect(401);
      });

      it("CUSTOMER -> 200 OK", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/users/me/profile")
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(200);
      });

      it("ADMIN -> 200 OK", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/users/me/profile")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe("Endpoint: GET /api/v1/users/me/tickets", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/users/me/tickets")
          .expect(401);
      });

      it("CUSTOMER -> 200 OK", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/users/me/tickets")
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(200);
      });
    });

    describe("Endpoint: GET /api/v1/tickets/:id/dynamic-qr", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/tickets/${ticket1Id}/dynamic-qr`)
          .expect(401);
      });

      it("Non-Owner CUSTOMER -> 403 FORBIDDEN", async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/tickets/${ticket1Id}/dynamic-qr`)
          .set("Authorization", `Bearer ${otherCustomerToken}`)
          .expect(403);
        expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
      });

      it("Ticket Owner CUSTOMER -> 200 OK with HMAC token", async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/tickets/${ticket1Id}/dynamic-qr`)
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.expiresAt).toBeDefined();
      });

      it("ADMIN -> 200 OK (Owner bypass)", async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/tickets/${ticket1Id}/dynamic-qr`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.token).toBeDefined();
      });
    });

    describe("Endpoint: PATCH /api/v1/tickets/:id/rotate-key", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .patch(`/api/v1/tickets/${ticket1Id}/rotate-key`)
          .expect(401);
      });

      it("CUSTOMER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .patch(`/api/v1/tickets/${ticket1Id}/rotate-key`)
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(403);
      });

      it("ORGANIZER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .patch(`/api/v1/tickets/${ticket1Id}/rotate-key`)
          .set("Authorization", `Bearer ${organizer1Token}`)
          .expect(403);
      });

      it("ADMIN -> 200 OK", async () => {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/tickets/${ticket1Id}/rotate-key`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.seedVersion).toBe(2);
      });
    });

    describe("Endpoint: POST /api/v1/gate/scan", () => {
      const scanPayload = {
        qrToken: "mock-qr-token-for-test",
        eventId: event1Id,
      };

      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/gate/scan")
          .send(scanPayload)
          .expect(401);
      });

      it("CUSTOMER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/gate/scan")
          .set("Authorization", `Bearer ${customerToken}`)
          .send(scanPayload)
          .expect(403);
      });

      it("GATE_STAFF -> Allowed through RBAC gate", async () => {
        const res = await request(app.getHttpServer())
          .post("/api/v1/gate/scan")
          .set("Authorization", `Bearer ${gateStaffToken}`)
          .send(scanPayload);
        // RBAC passed: status is NOT 401 or 403
        expect([200, 400]).toContain(res.status);
      });

      it("ADMIN -> Allowed through RBAC gate", async () => {
        const res = await request(app.getHttpServer())
          .post("/api/v1/gate/scan")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(scanPayload);
        expect([200, 400]).toContain(res.status);
      });
    });

    describe("Endpoint: POST /api/v1/resale/listings", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/resale/listings")
          .send({ ticketId: ticket1Id, askingPriceMinor: 5000 })
          .expect(401);
      });

      it("GATE_STAFF -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/resale/listings")
          .set("Authorization", `Bearer ${gateStaffToken}`)
          .send({ ticketId: ticket1Id, askingPriceMinor: 5000 })
          .expect(403);
      });

      it("CUSTOMER -> Authenticated resale access", async () => {
        const res = await request(app.getHttpServer())
          .post("/api/v1/resale/listings")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({ ticketId: ticket1Id, askingPriceMinor: 5000 });
        // Passes authentication guard (not 401 or 403)
        expect([201, 400, 409]).toContain(res.status);
      });
    });

    describe("Endpoint: POST /api/v1/venues", () => {
      const venuePayload = {
        name: "Test Arena",
        location: "Test Location",
        layout: {
          schemaVersion: 1,
          name: "Test Layout",
          dimensions: { width: 1000, height: 800 },
          sections: [
            {
              type: "grid",
              id: "SEC-1",
              name: "General",
              origin: { x: 10, y: 10 },
              rows: 5,
              columns: 10,
              seatWidth: 20,
              gapX: 5,
              gapY: 5,
              staggerOffset: 0,
              aisleColumns: [],
              aisleWidth: 0,
            },
          ],
        },
      };

      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/venues")
          .send(venuePayload)
          .expect(401);
      });

      it("CUSTOMER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/venues")
          .set("Authorization", `Bearer ${customerToken}`)
          .send(venuePayload)
          .expect(403);
      });

      it("ORGANIZER -> 201 CREATED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/venues")
          .set("Authorization", `Bearer ${organizer1Token}`)
          .send(venuePayload)
          .expect(201);
      });

      it("ADMIN -> 201 CREATED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/venues")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(venuePayload)
          .expect(201);
      });
    });

    describe("Endpoint: POST /api/v1/events", () => {
      const eventPayload = {
        venueId: "v1",
        name: "Test Event",
        startTime: new Date(Date.now() + 86400000).toISOString(),
      };

      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/events")
          .send(eventPayload)
          .expect(401);
      });

      it("CUSTOMER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/events")
          .set("Authorization", `Bearer ${customerToken}`)
          .send(eventPayload)
          .expect(403);
      });

      it("ORGANIZER -> 201 CREATED", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/events")
          .set("Authorization", `Bearer ${organizer1Token}`)
          .send(eventPayload)
          .expect(201);
      });
    });

    describe("Endpoint: POST /api/v1/events/:id/generate-seats", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/events/${event1Id}/generate-seats`)
          .expect(401);
      });

      it("CUSTOMER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/events/${event1Id}/generate-seats`)
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(403);
      });

      it("ORGANIZER -> Allowed (200 or processed)", async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/events/${event1Id}/generate-seats`)
          .set("Authorization", `Bearer ${organizer1Token}`);
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      });
    });

    describe("Endpoint: GET /api/v1/orders/:id", () => {
      const orderId = "ord-security-01";

      beforeAll(() => {
        ordersStore.set(orderId, {
          id: orderId,
          userId: customerId,
          eventId: event1Id,
          totalAmount: 5000,
          currency: "PKR",
          status: OrderStatus.COMPLETED,
          items: [],
        });
      });

      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/orders/${orderId}`)
          .expect(401);
      });

      it("CUSTOMER -> 200 OK", async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/orders/${orderId}`)
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(200);
        expect(res.body.id).toBe(orderId);
      });

      it("ADMIN -> 200 OK", async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/orders/${orderId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.id).toBe(orderId);
      });
    });

    describe("Endpoint: GET /api/v1/admin/audit-logs", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/admin/audit-logs")
          .expect(401);
      });

      it("CUSTOMER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/admin/audit-logs")
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(403);
      });

      it("ORGANIZER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/admin/audit-logs")
          .set("Authorization", `Bearer ${organizer1Token}`)
          .expect(403);
      });

      it("ADMIN -> 200 OK", async () => {
        const res = await request(app.getHttpServer())
          .get("/api/v1/admin/audit-logs")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.items).toBeDefined();
      });
    });

    describe("Endpoint: GET /api/v1/admin/settings/commission", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/admin/settings/commission")
          .expect(401);
      });

      it("ORGANIZER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/admin/settings/commission")
          .set("Authorization", `Bearer ${organizer1Token}`)
          .expect(403);
      });

      it("ADMIN -> 200 OK", async () => {
        const res = await request(app.getHttpServer())
          .get("/api/v1/admin/settings/commission")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.commissionRatePercent).toBeDefined();
      });
    });

    describe("Endpoint: GET /api/v1/organizer/analytics/:eventId", () => {
      it("Unauthenticated -> 401 UNAUTHORIZED", async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/organizer/analytics/${event1Id}`)
          .expect(401);
      });

      it("CUSTOMER -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/organizer/analytics/${event1Id}`)
          .set("Authorization", `Bearer ${customerToken}`)
          .expect(403);
      });

      it("GATE_STAFF -> 403 FORBIDDEN", async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/organizer/analytics/${event1Id}`)
          .set("Authorization", `Bearer ${gateStaffToken}`)
          .expect(403);
      });

      it("Matching ORGANIZER -> 200 OK", async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/organizer/analytics/${event1Id}`)
          .set("Authorization", `Bearer ${organizer1Token}`)
          .expect(200);
        expect(res.body.eventId).toBe(event1Id);
      });

      it("ADMIN -> 200 OK (Global access)", async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/organizer/analytics/${event1Id}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.eventId).toBe(event1Id);
      });
    });
  });

  describe("3. Tenant Isolation, Token Rotation Replay & Log Redaction Matrix", () => {
    describe("Refresh Token Rotation & Family Reuse Revocation", () => {
      it("should detect reuse via /api/v1/auth/refresh and revoke all family tokens", async () => {
        const familyId = "fam-security-test-01";
        const rawOldToken = "old-replayed-refresh-token-secret-123";
        const oldTokenHash = crypto
          .createHash("sha256")
          .update(rawOldToken)
          .digest("hex");

        const rawChildToken = "active-child-refresh-token-secret-456";
        const childTokenHash = crypto
          .createHash("sha256")
          .update(rawChildToken)
          .digest("hex");

        // Seed old token (already revoked after normal rotation)
        refreshTokensStore.set(oldTokenHash, {
          id: "rt-1",
          userId: customerId,
          tokenHash: oldTokenHash,
          familyId,
          isRevoked: true,
          expiresAt: new Date(Date.now() + 86400000),
        });

        // Seed active child token in the same family
        refreshTokensStore.set(childTokenHash, {
          id: "rt-2",
          userId: customerId,
          tokenHash: childTokenHash,
          familyId,
          isRevoked: false,
          expiresAt: new Date(Date.now() + 86400000),
        });

        // Adversary replays the revoked old token via HttpOnly cookie to /api/v1/auth/refresh
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/refresh")
          .set("Cookie", `refreshToken=${rawOldToken}`)
          .expect(401);

        expect(res.body.error.code).toBe(ErrorCode.INVALID_REFRESH_TOKEN);
        expect(res.body.error.message).toContain("Token reuse detected");

        // Assert that the active child token was revoked via the family revocation
        const childRecord = refreshTokensStore.get(childTokenHash);
        expect(childRecord.isRevoked).toBe(true);

        // Subsequent attempt with child token now also fails
        const childRes = await request(app.getHttpServer())
          .post("/api/v1/auth/refresh")
          .set("Cookie", `refreshToken=${rawChildToken}`)
          .expect(401);

        expect(childRes.body.error.code).toBe(ErrorCode.INVALID_REFRESH_TOKEN);
      });
    });

    describe("Organizer Cross-Tenant Isolation (OwnershipGuard)", () => {
      let ownershipGuard: OwnershipGuard;

      beforeEach(() => {
        ownershipGuard = new OwnershipGuard();
      });

      it("should deny access when Organizer 1 attempts to access Organizer 2 resources", () => {
        const mockContext = {
          switchToHttp: () => ({
            getRequest: () => ({
              user: {
                id: organizer1Id,
                role: UserRole.ORGANIZER,
                organizerTenantId: organizer1Id,
              },
              params: { organizerId: organizer2Id },
            }),
          }),
        } as any;

        expect(() => ownershipGuard.canActivate(mockContext)).toThrow(
          "Cross-tenant access forbidden",
        );
      });

      it("should permit access when Organizer accesses their own tenant resources", () => {
        const mockContext = {
          switchToHttp: () => ({
            getRequest: () => ({
              user: {
                id: organizer1Id,
                role: UserRole.ORGANIZER,
                organizerTenantId: organizer1Id,
              },
              params: { organizerId: organizer1Id },
            }),
          }),
        } as any;

        expect(ownershipGuard.canActivate(mockContext)).toBe(true);
      });

      it("should allow ADMIN to bypass tenant boundary for platform management", () => {
        const mockContext = {
          switchToHttp: () => ({
            getRequest: () => ({
              user: {
                id: adminId,
                role: UserRole.ADMIN,
              },
              params: { organizerId: organizer2Id },
            }),
          }),
        } as any;

        expect(ownershipGuard.canActivate(mockContext)).toBe(true);
      });

      it("should reject cross-tenant access via analytics endpoint (Organizer 2 targeting Organizer 1 event)", async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/organizer/analytics/${event1Id}`)
          .set("Authorization", `Bearer ${organizer2Token}`)
          .expect(403);

        expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
      });
    });

    describe("Sensitive Field Log Redaction Matrix", () => {
      it("should scrub all credentials, tokens, cookies, and dynamic QR keys before logging", () => {
        const incomingAuditLog = {
          timestamp: new Date().toISOString(),
          ip: "127.0.0.1",
          user: {
            id: customerId,
            password: "UnhashedPlainTextPassword!",
            passwordHash: "$2a$10$e84YdK98gQzO/4D5g6jP",
          },
          auth: {
            accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret",
            refreshToken: "rt-live-secret-refresh-token",
            token: "temp-bearer-token",
          },
          requestHeaders: {
            authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token",
            cookie: "refreshToken=s%3Axyz; session_id=sess_12345",
          },
          qrTicket: {
            ticketId: ticket1Id,
            qrToken: "hmac-sha256-decaying-token",
            qrPayload: "raw-qr-payload-data",
            secret: "dev-master-ticket-secret",
            hmac: "generated-signature-key",
            seed: "seed_v1",
          },
        };

        const safeLog = redactSensitiveData(incomingAuditLog);

        expect(safeLog.user.password).toBe("[REDACTED]");
        expect(safeLog.user.passwordHash).toBe("[REDACTED]");
        expect(safeLog.auth.accessToken).toBe("[REDACTED]");
        expect(safeLog.auth.refreshToken).toBe("[REDACTED]");
        expect(safeLog.auth.token).toBe("[REDACTED]");
        expect(safeLog.requestHeaders.authorization).toBe("[REDACTED]");
        expect(safeLog.requestHeaders.cookie).toBe("[REDACTED]");
        expect(safeLog.qrTicket.qrToken).toBe("[REDACTED]");
        expect(safeLog.qrTicket.qrPayload).toBe("[REDACTED]");
        expect(safeLog.qrTicket.secret).toBe("[REDACTED]");
        expect(safeLog.qrTicket.hmac).toBe("[REDACTED]");
        expect(safeLog.qrTicket.seed).toBe("[REDACTED]");

        // Non-sensitive data remains intact
        expect(safeLog.ip).toBe("127.0.0.1");
        expect(safeLog.qrTicket.ticketId).toBe(ticket1Id);
      });
    });
  });
});
