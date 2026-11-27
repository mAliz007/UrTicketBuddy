import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Event } from "./event.entity";

@Entity("venues")
export class Venue {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_venues_organizer_id")
  @Column({ type: "varchar", length: 255, nullable: true })
  organizerId?: string | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  location!: string;

  @Column({ type: "varchar", length: 64 })
  layoutMongoId!: string;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @OneToMany(() => Event, (event) => event.venue)
  events!: Event[];
}
