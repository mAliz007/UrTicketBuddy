import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { Venue } from "./venue.entity";
import { EventSeat } from "./event-seat.entity";
import { TicketTier } from "./ticket-tier.entity";

@Entity("events")
export class Event {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_events_venue_id")
  @Column({ type: "uuid" })
  venueId!: string;

  @Index("idx_events_organizer_id")
  @Column({ type: "varchar", length: 255, nullable: true })
  organizerId?: string | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "timestamp with time zone" })
  startTime!: Date;

  @Column({ type: "varchar", length: 50, default: "DRAFT" })
  status!: string;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @ManyToOne(() => Venue, (venue) => venue.events, { onDelete: "CASCADE" })
  @JoinColumn({ name: "venueId" })
  venue!: Venue;

  @OneToMany(() => EventSeat, (seat) => seat.event)
  seats!: EventSeat[];

  @OneToMany(() => TicketTier, (tier) => tier.event)
  ticketTiers!: TicketTier[];
}
