import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Ticket } from "./ticket.entity";
import { Event } from "./event.entity";

@Entity("gate_scans")
export class GateScan {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_gate_scans_ticket_id")
  @Column({ type: "uuid", nullable: true })
  ticketId!: string | null;

  @Index("idx_gate_scans_event_id")
  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar", length: 255 })
  scannedBy!: string;

  @Column({ type: "varchar", length: 50 })
  result!: string;

  @CreateDateColumn({ type: "timestamp with time zone" })
  scannedAt!: Date;

  @ManyToOne(() => Ticket, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "ticketId" })
  ticket?: Ticket | null;

  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event!: Event;
}
