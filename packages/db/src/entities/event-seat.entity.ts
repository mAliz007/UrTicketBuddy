import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { Event } from "./event.entity";

@Entity("event_seats")
@Unique("uq_event_seats_event_seat", ["eventId", "seatId"])
export class EventSeat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_event_seats_event_id")
  @Column({ type: "uuid" })
  eventId!: string;

  @Index("idx_event_seats_seat_id")
  @Column({ type: "varchar", length: 100 })
  seatId!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  tierId!: string | null;

  @Column({ type: "double precision" })
  x!: number;

  @Column({ type: "double precision" })
  y!: number;

  @Column({ type: "varchar", length: 50, default: "AVAILABLE" })
  status!: string;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @ManyToOne(() => Event, (event) => event.seats, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event!: Event;
}
