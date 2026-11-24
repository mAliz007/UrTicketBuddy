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
import { Ticket } from "./ticket.entity";
import { Event } from "./event.entity";

@Entity("resale_listings")
@Index("uq_resale_listings_active_ticket", ["ticketId"], {
  unique: true,
  where: "\"status\" = 'ACTIVE'",
})
export class ResaleListing {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_resale_listings_ticket_id")
  @Column({ type: "uuid" })
  ticketId!: string;

  @Index("idx_resale_listings_event_id")
  @Column({ type: "uuid" })
  eventId!: string;

  @Index("idx_resale_listings_seller_id")
  @Column({ type: "varchar", length: 255 })
  sellerId!: string;

  @Column({ type: "int" })
  askingPriceMinor!: number;

  @Column({ type: "varchar", length: 50, default: "ACTIVE" })
  status!: string;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @ManyToOne(() => Ticket, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ticketId" })
  ticket!: Ticket;

  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event!: Event;
}
