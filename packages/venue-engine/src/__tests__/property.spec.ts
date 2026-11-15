import * as fc from "fast-check";
import {
  generateGrid,
  generateArc,
  generateTableCluster,
  degToRad,
  parseLayout,
  serializeLayout,
} from "../index";
import { VenueLayout } from "@urticketbuddy/contracts";

describe("Property-based testing with fast-check", () => {
  it("Property: Exact seat counts match expected mathematical output", () => {
    // 1. Grid section seat count
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        fc.integer({ min: 1, max: 15 }),
        fc.double({ min: 10, max: 50, noNaN: true }),
        (rows, columns, seatWidth) => {
          const seats = generateGrid({
            origin: { x: 0, y: 0 },
            rows,
            columns,
            seatWidth,
            gapX: 5,
            gapY: 5,
            sectionId: "P_GRID",
          });
          return seats.length === rows * columns;
        },
      ),
      { numRuns: 50 },
    );

    // 2. Arc section seat count
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 300, noNaN: true }),
        fc.double({ min: 20, max: 50, noNaN: true }),
        fc.integer({ min: 1, max: 5 }),
        fc.double({ min: 15, max: 30, noNaN: true }),
        fc.double({ min: 2, max: 10, noNaN: true }),
        (rInner, rowGap, rows, seatWidth, gapX) => {
          const thetaStart = 0;
          const thetaEnd = Math.PI / 2; // 90 deg
          const thetaSpan = thetaEnd - thetaStart;

          let expectedSeats = 0;
          for (let r = 0; r < rows; r++) {
            const radius = rInner + r * rowGap;
            expectedSeats += Math.floor(
              (radius * thetaSpan + gapX) / (seatWidth + gapX),
            );
          }

          const seats = generateArc({
            center: { x: 0, y: 0 },
            thetaStart,
            thetaEnd,
            rInner,
            rowGap,
            rows,
            seatWidth,
            gapX,
            sectionId: "P_ARC",
          });

          return seats.length === expectedSeats;
        },
      ),
      { numRuns: 50 },
    );

    // 3. Table cluster seat count
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.double({ min: 30, max: 100, noNaN: true }),
        (seatCount, tableRadius) => {
          const cluster = generateTableCluster({
            center: { x: 100, y: 100 },
            tableRadius,
            seatCount,
            sectionId: "P_TABLE",
          });
          return cluster.seats.length === seatCount;
        },
      ),
      { numRuns: 50 },
    );
  });

  it("Property: Arc seats always face the center point (test rotation vector)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: 50, max: 300, noNaN: true }),
        fc.double({ min: 0, max: Math.PI, noNaN: true }),
        (cx, cy, rInner, thetaStart) => {
          const thetaEnd = thetaStart + Math.PI / 3;
          const center = { x: cx, y: cy };
          const seats = generateArc({
            center,
            thetaStart,
            thetaEnd,
            rInner,
            rowGap: 30,
            rows: 2,
            seatWidth: 20,
            gapX: 5,
            sectionId: "ARC_ROT",
          });

          for (const seat of seats) {
            // Vector from seat to center
            const dx = center.x - seat.x;
            const dy = center.y - seat.y;
            const radius = Math.hypot(dx, dy);

            // Unit vector towards center
            const ux = dx / radius;
            const uy = dy / radius;

            // Seat rotation gives tangent vector (theta + 90 deg)
            const rotRad = degToRad(seat.rotation);
            const tx = Math.cos(rotRad);
            const ty = Math.sin(rotRad);

            // Perpendicular condition: dot product between tangent and radius must be 0
            const dot = ux * tx + uy * ty;
            if (Math.abs(dot) > 1e-2) {
              return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 50 },
    );
  });

  it("Property: Distance between any two seats in a row is never less than seatWidth", () => {
    // 1. Grid rows
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.double({ min: 15, max: 40, noNaN: true }),
        fc.double({ min: 0, max: 15, noNaN: true }),
        (columns, seatWidth, gapX) => {
          const seats = generateGrid({
            origin: { x: 0, y: 0 },
            rows: 1,
            columns,
            seatWidth,
            gapX,
            gapY: 10,
            sectionId: "DIST_GRID",
          });

          for (let i = 0; i < seats.length; i++) {
            for (let j = i + 1; j < seats.length; j++) {
              const dist = Math.hypot(
                seats[i].x - seats[j].x,
                seats[i].y - seats[j].y,
              );
              // Tolerance of 1e-3 for floating point rounding
              if (dist < seatWidth - 1e-3) {
                return false;
              }
            }
          }
          return true;
        },
      ),
      { numRuns: 50 },
    );

    // 2. Arc rows
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 300, noNaN: true }),
        fc.double({ min: 15, max: 35, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (rInner, seatWidth, gapX) => {
          const seats = generateArc({
            center: { x: 0, y: 0 },
            thetaStart: 0,
            thetaEnd: Math.PI / 2,
            rInner,
            rowGap: 30,
            rows: 1,
            seatWidth,
            gapX,
            sectionId: "DIST_ARC",
          });

          for (let i = 0; i < seats.length; i++) {
            for (let j = i + 1; j < seats.length; j++) {
              const dist = Math.hypot(
                seats[i].x - seats[j].x,
                seats[i].y - seats[j].y,
              );
              if (dist < seatWidth - 1e-3) {
                return false;
              }
            }
          }
          return true;
        },
      ),
      { numRuns: 50 },
    );
  });

  it("Property: Round-trip parseLayout(serializeLayout(obj)) produces identical data", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (rows, cols) => {
          const seats = generateGrid({
            origin: { x: 50, y: 50 },
            rows,
            columns: cols,
            seatWidth: 20,
            gapX: 5,
            gapY: 5,
            sectionId: "ROUND",
          });

          const layout: VenueLayout = {
            schemaVersion: 1,
            name: "Round Trip Venue",
            dimensions: { width: 1000, height: 1000 },
            sections: [
              {
                type: "grid",
                id: "ROUND",
                origin: { x: 50, y: 50 },
                rows,
                columns: cols,
                seatWidth: 20,
                gapX: 5,
                gapY: 5,
                staggerOffset: 0,
                aisleColumns: [],
                aisleWidth: 0,
              },
            ],
            seats,
          };

          const internal = parseLayout(layout);
          const serialized = serializeLayout(internal);

          // Check top-level properties
          expect(serialized.schemaVersion).toBe(layout.schemaVersion);
          expect(serialized.name).toBe(layout.name);
          expect(serialized.seats).toHaveLength(layout.seats.length);

          // Check each seat
          for (let i = 0; i < layout.seats.length; i++) {
            expect(serialized.seats[i].id).toBe(layout.seats[i].id);
            expect(serialized.seats[i].x).toBeCloseTo(layout.seats[i].x, 3);
            expect(serialized.seats[i].y).toBeCloseTo(layout.seats[i].y, 3);
            expect(serialized.seats[i].rotation).toBeCloseTo(
              layout.seats[i].rotation,
              2,
            );
          }
          return true;
        },
      ),
      { numRuns: 20 },
    );
  });
});
