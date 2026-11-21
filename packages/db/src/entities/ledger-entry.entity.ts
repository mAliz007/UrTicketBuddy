import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { ResaleListing } from "./resale-listing.entity";

@Entity("ledger_entries")
export class LedgerEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_ledger_entries_listing_id")
  @Column({ type: "uuid" })
  listingId!: string;

  @Column({ type: "varchar", length: 255 })
  account!: string;

  @Column({ type: "int" })
  amountMinor!: number;

  @Column({ type: "varchar", length: 50 })
  kind!: string;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @ManyToOne(() => ResaleListing, { onDelete: "CASCADE" })
  @JoinColumn({ name: "listingId" })
  listing!: ResaleListing;
}
