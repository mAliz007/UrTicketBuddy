import {
  VenueLayout,
  VenueLayoutSchema,
  SeatNode,
  degToRad,
  radToDeg,
  SectionConfig,
} from "@urticketbuddy/contracts";

/**
 * Custom error thrown when layout parsing, schema validation, or geometric constraints fail.
 */
export class InvalidLayoutError extends Error {
  constructor(
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = "InvalidLayoutError";
  }
}

/**
 * Internal seat representation where rotation is stored in RADIANS for math operations.
 */
export interface InternalSeatNode extends Omit<SeatNode, "rotation"> {
  rotation: number; // in radians
}

/**
 * Internal layout representation where internal seat angles are in radians.
 */
export interface InternalVenueLayout extends Omit<VenueLayout, "seats"> {
  seats: InternalSeatNode[];
}

/**
 * Validates geometric edge cases across all section configurations.
 */
function validateSectionConstraints(sections: SectionConfig[]): void {
  for (const s of sections) {
    if (s.type === "grid") {
      if (s.seatWidth <= 0) {
        throw new InvalidLayoutError(
          `Grid section "${s.id}" has invalid seatWidth: ${s.seatWidth}. Must be positive.`,
        );
      }
      if (s.rows <= 0 || s.columns <= 0) {
        throw new InvalidLayoutError(
          `Grid section "${s.id}" rows and columns must be positive integers.`,
        );
      }
      if (s.gapX < 0 || s.gapY < 0) {
        throw new InvalidLayoutError(
          `Grid section "${s.id}" gapX and gapY must be non-negative.`,
        );
      }
    } else if (s.type === "arc") {
      if (s.seatWidth <= 0) {
        throw new InvalidLayoutError(
          `Arc section "${s.id}" has invalid seatWidth: ${s.seatWidth}. Must be positive.`,
        );
      }
      if (s.rInner <= 0) {
        throw new InvalidLayoutError(
          `Arc section "${s.id}" has invalid rInner: ${s.rInner}. Must be positive.`,
        );
      }
      if (s.rows <= 0) {
        throw new InvalidLayoutError(
          `Arc section "${s.id}" rows must be a positive integer.`,
        );
      }
      if (s.rowGap <= 0) {
        throw new InvalidLayoutError(
          `Arc section "${s.id}" rowGap must be positive.`,
        );
      }
      if (s.gapX < 0) {
        throw new InvalidLayoutError(
          `Arc section "${s.id}" gapX must be non-negative.`,
        );
      }
    } else if (s.type === "table") {
      if (s.tableRadius <= 0) {
        throw new InvalidLayoutError(
          `Table cluster "${s.id}" has invalid tableRadius: ${s.tableRadius}. Must be positive.`,
        );
      }
      if (s.seatCount <= 0) {
        throw new InvalidLayoutError(
          `Table cluster "${s.id}" seatCount must be a positive integer.`,
        );
      }
      if (s.seatWidth !== undefined && s.seatWidth <= 0) {
        throw new InvalidLayoutError(
          `Table cluster "${s.id}" seatWidth must be positive.`,
        );
      }
    }
  }
}

/**
 * Parses and validates raw JSON or an object into an InternalVenueLayout.
 * Converts seat rotations from DEGREES (schema) to RADIANS (runtime internal math).
 */
export function parseLayout(input: unknown): InternalVenueLayout {
  let parsedJson: unknown = input;
  if (typeof input === "string") {
    try {
      parsedJson = JSON.parse(input);
    } catch (err) {
      throw new InvalidLayoutError(
        `Failed to parse JSON string: ${(err as Error).message}`,
      );
    }
  }

  const result = VenueLayoutSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new InvalidLayoutError(
      `Layout schema validation failed: ${result.error.message}`,
      result.error.issues,
    );
  }

  const data = result.data;
  validateSectionConstraints(data.sections);

  // Convert seat rotations from degrees to radians
  const internalSeats: InternalSeatNode[] = data.seats.map((seat) => ({
    ...seat,
    rotation: degToRad(seat.rotation),
  }));

  return {
    ...data,
    seats: internalSeats,
  };
}

/**
 * Serializes an internal venue layout back into a schema-conforming VenueLayout object.
 * Converts seat rotations from RADIANS (internal math) to DEGREES (schema).
 */
export function serializeLayout(
  layout: InternalVenueLayout | VenueLayout,
): VenueLayout {
  const externalSeats: SeatNode[] = layout.seats.map((seat) => {
    // If the layout is already using degrees (e.g. from an unparsed schema), check or convert
    // We assume InternalVenueLayout passes radians; convert to degrees.
    const degrees = radToDeg(seat.rotation);
    return {
      ...seat,
      rotation: Number(degrees.toFixed(6)), // Clean floating point representation
    };
  });

  const serialized = {
    ...layout,
    seats: externalSeats,
  };

  const validation = VenueLayoutSchema.safeParse(serialized);
  if (!validation.success) {
    throw new InvalidLayoutError(
      `Serialization produced invalid layout: ${validation.error.message}`,
      validation.error.issues,
    );
  }

  return validation.data;
}
