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
import { Event } from "./event.entity";
import { OrderItem } from "./order-item.entity";

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_orders_user_id")
  @Column({ type: "varchar", length: 255 })
  userId!: string;

  @Index("idx_orders_event_id")
  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({ type: "varchar", length: 10, default: "PKR" })
  currency!: string;

  @Column({ type: "varchar", length: 50, default: "PENDING" })
  status!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  paymentGatewayRef!: string | null;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event!: Event;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];
}
