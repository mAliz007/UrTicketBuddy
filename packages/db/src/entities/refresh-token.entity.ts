import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_refresh_tokens_user_id")
  @Column({ type: "uuid" })
  userId!: string;

  @Index("idx_refresh_tokens_token_hash")
  @Column({ type: "varchar", length: 255 })
  tokenHash!: string;

  @Index("idx_refresh_tokens_family_id")
  @Column({ type: "uuid" })
  familyId!: string;

  @Column({ type: "boolean", default: false })
  isRevoked!: boolean;

  @Column({ type: "timestamp with time zone" })
  expiresAt!: Date;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;
}
