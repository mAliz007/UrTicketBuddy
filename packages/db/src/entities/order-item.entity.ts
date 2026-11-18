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
import { Order } from "./order.entity";
import { EventSeat } from "./event-seat.entity";

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_order_items_order_id")
  @Column({ type: "uuid" })
  orderId!: string;

  @Index("idx_order_items_event_seat_id")
  @Column({ type: "uuid" })
  eventSeatId!: string;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  price!: number;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: Order;

  @ManyToOne(() => EventSeat, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventSeatId" })
  eventSeat!: EventSeat;
}
