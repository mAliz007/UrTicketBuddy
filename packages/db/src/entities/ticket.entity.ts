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
import { EventSeat } from "./event-seat.entity";
import { Order } from "./order.entity";

@Entity("tickets")
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_tickets_event_id")
  @Column({ type: "uuid" })
  eventId!: string;

  @Index("idx_tickets_event_seat_id")
  @Column({ type: "uuid" })
  eventSeatId!: string;

  @Index("idx_tickets_order_id")
  @Column({ type: "uuid" })
  orderId!: string;

  @Index("idx_tickets_owner_id")
  @Column({ type: "varchar", length: 255 })
  ownerId!: string;

  @Column({ type: "varchar", length: 50, default: "ISSUED" })
  status!: string;

  @Column({ type: "int", default: 1 })
  seedVersion!: number;

  @Column({ type: "int", default: 100000 })
  faceValueMinor!: number;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event!: Event;

  @ManyToOne(() => EventSeat, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventSeatId" })
  eventSeat!: EventSeat;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: Order;
}
