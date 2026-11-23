import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_audit_logs_actor_id")
  @Column({ type: "varchar", length: 255 })
  actorId!: string;

  @Column({ type: "varchar", length: 50 })
  actorRole!: string;

  @Index("idx_audit_logs_action")
  @Column({ type: "varchar", length: 100 })
  action!: string;

  @Column({ type: "varchar", length: 100 })
  entityType!: string;

  @Column({ type: "varchar", length: 255 })
  entityId!: string;

  @Column({ type: "text", nullable: true })
  summary?: string | null;

  @Column({ type: "jsonb", nullable: true })
  beforeState?: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  afterState?: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  ipAddress?: string | null;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;
}
