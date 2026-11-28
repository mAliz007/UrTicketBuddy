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
import { Event } from "./event.entity";

@Entity("ticket_tiers")
export class TicketTier {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_ticket_tiers_event_id")
  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "integer" })
  priceMinor!: number;

  @Column({ type: "varchar", length: 10, default: "PKR" })
  currency!: string;

  @Column({ type: "integer", nullable: true })
  capacity?: number | null;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @ManyToOne(() => Event, (event) => event.ticketTiers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event!: Event;
}
