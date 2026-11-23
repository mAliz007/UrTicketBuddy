import { Injectable, Inject, Logger } from "@nestjs/common";
import { Repository, FindOptionsWhere } from "typeorm";
import { AuditLog } from "@urticketbuddy/db";
import {
  AuditLogQuery,
  PaginatedAuditLogs,
  AuditLogDto,
} from "@urticketbuddy/contracts";
import { AUDIT_LOG_REPOSITORY } from "../../database/database.tokens";

export interface RecordAuditLogParams {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Records an immutable append-only audit log row.
   * Note: The underlying PostgreSQL database table has trigger trg_audit_logs_immutable
   * which forbids any UPDATE or DELETE operations.
   */
  async recordLog(params: RecordAuditLogParams): Promise<AuditLogDto> {
    const entry = this.auditLogRepository.create({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary || null,
      beforeState: params.beforeState || null,
      afterState: params.afterState || null,
      ipAddress: params.ipAddress || null,
    });

    const saved = await this.auditLogRepository.save(entry);
    this.logger.log(
      `[AuditLog] ${saved.action} on ${saved.entityType}:${saved.entityId} by ${saved.actorRole}:${saved.actorId}`,
    );

    return saved;
  }

  /**
   * Retrieves paginated and filtered audit logs.
   */
  async getLogs(query: AuditLogQuery): Promise<PaginatedAuditLogs> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where: FindOptionsWhere<AuditLog> = {};
    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }

    const [items, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip,
      take: pageSize,
    });

    return {
      items,
      page,
      pageSize,
      total,
    };
  }
}
