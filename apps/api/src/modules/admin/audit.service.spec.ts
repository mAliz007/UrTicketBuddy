import { Test, TestingModule } from "@nestjs/testing";
import { Repository, EntityManager } from "typeorm";
import { AuditLog } from "@urticketbuddy/db";
import { AuditService } from "./audit.service";
import { AUDIT_LOG_REPOSITORY } from "../../database/database.tokens";

describe("AuditService (Unit Tests)", () => {
  let service: AuditService;
  let mockAuditRepo: Partial<Record<keyof Repository<AuditLog>, jest.Mock>>;

  const fakeLogs: AuditLog[] = [];

  beforeEach(async () => {
    fakeLogs.length = 0;

    mockAuditRepo = {
      create: jest.fn((dto) => ({
        id: "log-uuid-1",
        createdAt: new Date(),
        ...dto,
      })),
      save: jest.fn(async (log) => {
        fakeLogs.push(log);
        return log;
      }),
      findAndCount: jest.fn(async ({ where, skip, take }) => {
        let filtered = [...fakeLogs];
        if (where?.actorId) {
          filtered = filtered.filter((l) => l.actorId === where.actorId);
        }
        if (where?.action) {
          filtered = filtered.filter((l) => l.action === where.action);
        }
        if (where?.entityType) {
          filtered = filtered.filter((l) => l.entityType === where.entityType);
        }
        const total = filtered.length;
        const items = filtered.slice(skip, skip + take);
        return [items, total];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: AUDIT_LOG_REPOSITORY,
          useValue: mockAuditRepo,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it("should record an immutable audit log entry with all metadata", async () => {
    const entry = await service.recordLog({
      actorId: "admin-1",
      actorRole: "ADMIN",
      action: "TICKET_REVOKED",
      entityType: "Ticket",
      entityId: "ticket-100",
      summary: "Revocation due to chargeback",
      beforeState: { status: "ISSUED" },
      afterState: { status: "REVOKED" },
      ipAddress: "127.0.0.1",
    });

    expect(entry).toBeDefined();
    expect(entry.actorId).toBe("admin-1");
    expect(entry.action).toBe("TICKET_REVOKED");
    expect(entry.entityType).toBe("Ticket");
    expect(entry.entityId).toBe("ticket-100");
    expect(mockAuditRepo.save).toHaveBeenCalled();
  });

  it("should query paginated and filtered audit logs", async () => {
    await service.recordLog({
      actorId: "admin-1",
      actorRole: "ADMIN",
      action: "ORDER_FLAGGED",
      entityType: "Order",
      entityId: "order-1",
    });

    await service.recordLog({
      actorId: "admin-2",
      actorRole: "ADMIN",
      action: "TICKET_REVOKED",
      entityType: "Ticket",
      entityId: "ticket-2",
    });

    const resultAll = await service.getLogs({ page: 1, pageSize: 10 });
    expect(resultAll.total).toBe(2);
    expect(resultAll.items.length).toBe(2);

    const resultFiltered = await service.getLogs({
      actorId: "admin-1",
      page: 1,
      pageSize: 10,
    });
    expect(resultFiltered.total).toBe(1);
    expect(resultFiltered.items[0].entityId).toBe("order-1");
  });

  it("should record log using the provided EntityManager when passed", async () => {
    const customRepo = {
      create: jest.fn((dto) => ({ id: "tx-log-1", ...dto })),
      save: jest.fn(async (log) => log),
    };
    const mockEntityManager = {
      getRepository: jest.fn().mockReturnValue(customRepo),
    } as unknown as EntityManager;

    const entry = await service.recordLog(
      {
        actorId: "admin-tx",
        actorRole: "ADMIN",
        action: "ORDER_FLAGGED",
        entityType: "Order",
        entityId: "order-tx",
      },
      mockEntityManager,
    );

    expect(mockEntityManager.getRepository).toHaveBeenCalledWith(AuditLog);
    expect(customRepo.save).toHaveBeenCalled();
    expect(entry.id).toBe("tx-log-1");
  });

  it("should enforce immutability by not exposing update or delete methods", () => {
    const dynamicService = service as unknown as Record<string, unknown>;
    expect(dynamicService.update).toBeUndefined();
    expect(dynamicService.delete).toBeUndefined();
    expect(dynamicService.remove).toBeUndefined();
  });
});
