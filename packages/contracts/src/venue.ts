import { z } from "zod";

/**
 * Angle conversion helpers
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * 2D Point
 */
export const PointSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();
export type Point = z.infer<typeof PointSchema>;

/**
 * Seat Node Schema
 * Rotation in the schema is represented in DEGREES for human readability.
 */
export const SeatNodeSchema = z
  .object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    rotation: z.number(), // degrees in schema
    sectionId: z.string(),
    row: z.string(),
    number: z.string(),
    tierId: z.string().optional(),
    state: z.enum(["DISABLED"]).optional(),
  })
  .strict();
export type SeatNode = z.infer<typeof SeatNodeSchema>;

/**
 * Grid Section Configuration
 */
export const GridSectionConfigSchema = z
  .object({
    type: z.literal("grid"),
    id: z.string(),
    name: z.string().optional(),
    origin: PointSchema,
    rows: z.number().int().positive(),
    columns: z.number().int().positive(),
    seatWidth: z.number().positive(),
    gapX: z.number().nonnegative(),
    gapY: z.number().nonnegative(),
    staggerOffset: z.number().default(0),
    aisleColumns: z.array(z.number().int().nonnegative()).default([]),
    aisleWidth: z.number().nonnegative().default(0),
    tierId: z.string().optional(),
  })
  .strict();
export type GridSectionConfig = z.infer<typeof GridSectionConfigSchema>;

/**
 * Arc Section Configuration
 * thetaStart and thetaEnd in the schema are in DEGREES.
 */
export const ArcSectionConfigSchema = z
  .object({
    type: z.literal("arc"),
    id: z.string(),
    name: z.string().optional(),
    center: PointSchema,
    thetaStart: z.number(), // degrees
    thetaEnd: z.number(), // degrees
    rInner: z.number().positive(),
    rowGap: z.number().positive(),
    rows: z.number().int().positive(),
    seatWidth: z.number().positive(),
    gapX: z.number().nonnegative(),
    tierId: z.string().optional(),
  })
  .strict();
export type ArcSectionConfig = z.infer<typeof ArcSectionConfigSchema>;

/**
 * Table Cluster Configuration
 */
export const TableClusterConfigSchema = z
  .object({
    type: z.literal("table"),
    id: z.string(),
    name: z.string().optional(),
    center: PointSchema,
    tableRadius: z.number().positive(),
    seatCount: z.number().int().positive(),
    seatWidth: z.number().positive().optional(),
    startAngle: z.number().default(0), // degrees
    tierId: z.string().optional(),
  })
  .strict();
export type TableClusterConfig = z.infer<typeof TableClusterConfigSchema>;

/**
 * Union of Primitive Section Configurations
 */
export const SectionConfigSchema = z.discriminatedUnion("type", [
  GridSectionConfigSchema,
  ArcSectionConfigSchema,
  TableClusterConfigSchema,
]);
export type SectionConfig = z.infer<typeof SectionConfigSchema>;

/**
 * Venue Layout Schema (version: 1)
 */
export const VenueLayoutSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().optional(),
    name: z.string().min(1),
    dimensions: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict()
      .optional(),
    sections: z.array(SectionConfigSchema).default([]),
    seats: z.array(SeatNodeSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type VenueLayout = z.infer<typeof VenueLayoutSchema>;

export const TicketTierInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    priceMinor: z.number().int().nonnegative(),
    currency: z.string().min(3).max(10).default("PKR"),
    capacity: z.number().int().positive().nullable().optional(),
  })
  .strict();
export type TicketTierInput = z.infer<typeof TicketTierInputSchema>;

export const EventsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.string().optional(),
    venueId: z.guid().optional(),
    organizerId: z.string().optional(),
    search: z.string().optional(),
    q: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .strict();
export type EventsQuery = z.infer<typeof EventsQuerySchema>;

export const UpdateEventRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    startTime: z.string().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
    venueId: z.guid().optional(),
    ticketTiers: z.array(TicketTierInputSchema).optional(),
  })
  .strict();
export type UpdateEventRequest = z.infer<typeof UpdateEventRequestSchema>;
