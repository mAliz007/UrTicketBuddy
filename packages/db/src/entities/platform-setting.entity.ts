import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("platform_settings")
export class PlatformSetting {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_platform_settings_key", { unique: true })
  @Column({ type: "varchar", length: 100, unique: true })
  key!: string;

  @Column({ type: "varchar", length: 255, default: "10" })
  value!: string;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;
}
