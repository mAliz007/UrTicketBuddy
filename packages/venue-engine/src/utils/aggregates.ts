import { Point, SeatNode, VenueLayout } from "@urticketbuddy/contracts";
import { BoundingBox, boundingBox } from "./bounding-box";

export interface SectionAggregate {
  sectionId: string;
  seatCount: number;
  hull: Point[];
  bounds: BoundingBox;
}

/**
 * 2D cross product of OA and OB vectors.
 * Returns positive for counter-clockwise turn, negative for clockwise, 0 for collinear.
 */
function crossProduct(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Computes the convex hull polygon of a 2D point set using Andrew's monotone chain algorithm.
 * Complexity: O(n log n).
 */
export function convexHull(points: ReadonlyArray<Point>): Point[] {
  const n = points.length;
  if (n <= 2) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }

  // Deduplicate and sort points lexicographically by x, then by y
  const sorted = [...points].sort((a, b) => {
    if (a.x === b.x) return a.y - b.y;
    return a.x - b.x;
  });

  const unique: Point[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (
      i === 0 ||
      sorted[i].x !== sorted[i - 1].x ||
      sorted[i].y !== sorted[i - 1].y
    ) {
      unique.push(sorted[i]);
    }
  }

  if (unique.length <= 2) {
    return unique.map((p) => ({ x: p.x, y: p.y }));
  }

  const lower: Point[] = [];
  for (const p of unique) {
    while (
      lower.length >= 2 &&
      crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (
      upper.length >= 2 &&
      crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove the last point of each half because it is repeated at the beginning of the other
  lower.pop();
  upper.pop();

  return lower.concat(upper);
}

/**
 * Computes section-level aggregates (seat count, polygon hull, bounding box) for a venue layout.
 */
export function sectionAggregates(
  layout: Pick<VenueLayout, "sections" | "seats">,
): Record<string, SectionAggregate> {
  const seatsBySection = new Map<string, SeatNode[]>();

  // Initialize all known sections
  if (layout.sections) {
    for (const section of layout.sections) {
      seatsBySection.set(section.id, []);
    }
  }

  // Group seats
  if (layout.seats) {
    for (const seat of layout.seats) {
      const group = seatsBySection.get(seat.sectionId) ?? [];
      group.push(seat);
      seatsBySection.set(seat.sectionId, group);
    }
  }

  const aggregates: Record<string, SectionAggregate> = {};

  for (const [sectionId, seats] of seatsBySection.entries()) {
    const points: Point[] = seats.map((s) => ({ x: s.x, y: s.y }));
    aggregates[sectionId] = {
      sectionId,
      seatCount: seats.length,
      hull: convexHull(points),
      bounds: boundingBox(points),
    };
  }

  return aggregates;
}
