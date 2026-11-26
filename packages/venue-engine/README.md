# @urticketbuddy/venue-engine

Pure TypeScript mathematical core for parametric venue layouts and 2D seat coordinate calculations.

## Overview

- **Coordinate System**: Canvas standard where `(0, 0)` is the Top-Left origin. Positive X extends to the right; positive Y extends downward.
- **Pure Math**: Completely decoupled from DOM, Canvas, and Konva. Runs identically in backend NestJS services, BullMQ workers, and web clients.
- **Radians vs. Degrees**: Internal trigonometric math strictly operates in radians. Serialized layouts and JSON schemas expose degrees for human readability.
- **Deterministic Seat IDs**: Strictly formatted as `<sectionId>-<row>-<number>` (e.g., `SEC-A-12`).

---

## Generators

### 1. Arc Generator (`generateArc`)

Calculates 2D seat coordinates for curved or amphitheater sections. Seats are placed along concentric rows and automatically rotated to face radially inward toward the stage/origin center `(Xc, Yc)`.

#### Mathematical Formulation

- Radius for row `r`: $R_r = r_{inner} + r \cdot rowGap$
- Max seats per row:
  $$\text{maxSeats} = \left\lfloor \frac{R_r \cdot (\theta_{end} - \theta_{start}) + gapX}{seatWidth + gapX} \right\rfloor$$
- Seat position:
  $$x = X_c + R_r \cdot \cos(\theta), \quad y = Y_c + R_r \cdot \sin(\theta)$$
- Seat rotation: $\theta + 90^\circ$ (so the seat normal vector points toward the center).

#### Usage Example

```typescript
import { generateArc, Point } from "@urticketbuddy/venue-engine";

const center: Point = { x: 500, y: 500 };

const arcSeats = generateArc({
  center,
  thetaStart: 0,
  thetaEnd: Math.PI, // 180-degree half-circle arc
  rInner: 150, // Inner radius (distance from center to row A)
  rowGap: 35, // Distance between consecutive rows
  rows: 4, // 4 concentric rows (A, B, C, D)
  seatWidth: 20, // Seat physical width
  gapX: 5, // Lateral gap between adjacent seats
  sectionId: "ORCHESTRA",
  tierId: "TIER-VIP",
});

console.log(`Generated ${arcSeats.length} seats.`);
// Example seat node:
// {
//   id: "ORCHESTRA-A-1",
//   x: 650,
//   y: 500,
//   rotation: 90,
//   sectionId: "ORCHESTRA",
//   row: "A",
//   number: "1",
//   tierId: "TIER-VIP"
// }
```

---

### 2. Grid Generator (`generateGrid`)

Calculates rectangular grid layouts with support for row staggering and custom aisle configurations.

```typescript
import { generateGrid } from "@urticketbuddy/venue-engine";

const gridSeats = generateGrid({
  origin: { x: 50, y: 100 },
  rows: 10,
  columns: 14,
  seatWidth: 22,
  gapX: 4,
  gapY: 8,
  staggerOffset: 11, // Shifts odd rows horizontally for staggered visibility
  aisleColumns: [7], // Adds extra aisle clearance before column 7
  aisleWidth: 25,
  sectionId: "MAIN-FLOOR",
});
```

---

### 3. Table Cluster Generator (`generateTableCluster`)

Generates seats distributed radially around banquet or cabaret tables, returning group transform metadata.

```typescript
import { generateTableCluster } from "@urticketbuddy/venue-engine";

const table = generateTableCluster({
  center: { x: 300, y: 400 },
  tableRadius: 60,
  seatCount: 8,
  sectionId: "BANQUET",
  tableId: "T-01",
});

// Returns { id, sectionId, table, transform: { translate, rotate }, seats }
```

---

## Data Utilities

| Utility                          | Description                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `buildSeatId(section, row, num)` | Formats deterministic ID `<sectionId>-<row>-<number>`.                                                                         |
| `parseSeatId(id)`                | Parses a seat ID string into `{ sectionId, row, number }`.                                                                     |
| `rowToLabel(rowIndex)`           | Spreadsheet-style row label: `0 -> 'A'`, `25 -> 'Z'`, `26 -> 'AA'`.                                                            |
| `boundingBox(seats)`             | Calculates `{ minX, minY, maxX, maxY, width, height }`.                                                                        |
| `convexHull(points)`             | $O(n \log n)$ Andrew's monotone chain convex hull polygon.                                                                     |
| `sectionAggregates(layout)`      | Calculates section bounding box, seat count, and hull coordinates for Level-of-Detail (LoD) rendering.                         |
| `parseLayout(json)`              | Validates layout via Zod schema, verifies geometric constraints, and converts degrees to radians. Throws `InvalidLayoutError`. |
| `serializeLayout(layout)`        | Converts radians to human-readable degrees and serializes into `VenueLayout`.                                                  |

---

## Testing & Performance

- **Property-Based Testing**: Powered by `fast-check` to assert mathematical invariants (seat count precision, non-overlapping distances $\ge seatWidth$, and rotation vector alignment with center).
- **Performance Benchmark**: Generates 10,000 seats in under 200 ms (~40-60 ms typical in benchmark with V8 JIT warm-up and multi-tenant CI runner headroom).
