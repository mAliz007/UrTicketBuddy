import {
  rowToLabel,
  buildSeatId,
  parseSeatId,
  boundingBox,
  convexHull,
  sectionAggregates,
  parseLayout,
  serializeLayout,
  InvalidLayoutError,
} from "../index";

describe("Venue Engine Utilities", () => {
  describe("Seat IDs", () => {
    it("should generate deterministic IDs matching <sectionId>-<row>-<number>", () => {
      expect(buildSeatId("VIP", "A", 12)).toBe("VIP-A-12");
      expect(buildSeatId("MAIN", 0, "1")).toBe("MAIN-A-1");
      expect(buildSeatId("BALCONY", 25, 5)).toBe("BALCONY-Z-5");
      expect(buildSeatId("BALCONY", 26, 1)).toBe("BALCONY-AA-1");
    });

    it("should parse seat IDs correctly", () => {
      const parsed = parseSeatId("VIP-A-12");
      expect(parsed).toEqual({
        sectionId: "VIP",
        row: "A",
        number: "12",
      });

      const parsedHyphenSection = parseSeatId("LOWER-BOWL-B-3");
      expect(parsedHyphenSection).toEqual({
        sectionId: "LOWER-BOWL",
        row: "B",
        number: "3",
      });
    });

    it("should throw on invalid seat ID formats", () => {
      expect(() => parseSeatId("INVALID")).toThrow();
    });

    it("should convert numeric row indices to labels", () => {
      expect(rowToLabel(0)).toBe("A");
      expect(rowToLabel(1)).toBe("B");
      expect(rowToLabel(25)).toBe("Z");
      expect(rowToLabel(26)).toBe("AA");
      expect(rowToLabel(27)).toBe("AB");
      expect(() => rowToLabel(-1)).toThrow();
    });
  });

  describe("boundingBox", () => {
    it("should calculate min/max coordinates and dimensions", () => {
      const seats = [
        { x: 10, y: 20 },
        { x: 100, y: 50 },
        { x: 40, y: 200 },
      ];
      const box = boundingBox(seats);
      expect(box).toEqual({
        minX: 10,
        minY: 20,
        maxX: 100,
        maxY: 200,
        width: 90,
        height: 180,
      });
    });

    it("should handle empty seat array", () => {
      const box = boundingBox([]);
      expect(box).toEqual({
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0,
      });
    });
  });

  describe("Aggregates and Convex Hull", () => {
    it("should compute convex hull correctly", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 5, y: 5 }, // Interior point
      ];
      const hull = convexHull(points);
      expect(hull).toHaveLength(4);
      expect(hull).toContainEqual({ x: 0, y: 0 });
      expect(hull).toContainEqual({ x: 10, y: 0 });
      expect(hull).toContainEqual({ x: 10, y: 10 });
      expect(hull).toContainEqual({ x: 0, y: 10 });
    });

    it("should compute sectionAggregates with hull and seat count", () => {
      const layout = {
        sections: [
          {
            type: "grid" as const,
            id: "SEC1",
            origin: { x: 0, y: 0 },
            rows: 2,
            columns: 2,
            seatWidth: 20,
            gapX: 5,
            gapY: 5,
            staggerOffset: 0,
            aisleColumns: [],
            aisleWidth: 0,
          },
        ],
        seats: [
          {
            id: "SEC1-A-1",
            x: 0,
            y: 0,
            rotation: 0,
            sectionId: "SEC1",
            row: "A",
            number: "1",
          },
          {
            id: "SEC1-A-2",
            x: 25,
            y: 0,
            rotation: 0,
            sectionId: "SEC1",
            row: "A",
            number: "2",
          },
          {
            id: "SEC1-B-1",
            x: 0,
            y: 25,
            rotation: 0,
            sectionId: "SEC1",
            row: "B",
            number: "1",
          },
          {
            id: "SEC1-B-2",
            x: 25,
            y: 25,
            rotation: 0,
            sectionId: "SEC1",
            row: "B",
            number: "2",
          },
        ],
      };

      const agg = sectionAggregates(layout);
      expect(agg["SEC1"]).toBeDefined();
      expect(agg["SEC1"].seatCount).toBe(4);
      expect(agg["SEC1"].bounds.width).toBe(25);
      expect(agg["SEC1"].bounds.height).toBe(25);
      expect(agg["SEC1"].hull.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Parser and Edge Cases", () => {
    it("should throw InvalidLayoutError for negative seatWidth", () => {
      const invalid = {
        schemaVersion: 1,
        name: "Invalid Grid",
        sections: [
          {
            type: "grid",
            id: "G1",
            origin: { x: 0, y: 0 },
            rows: 2,
            columns: 2,
            seatWidth: -10, // Invalid!
            gapX: 5,
            gapY: 5,
          },
        ],
        seats: [],
      };

      expect(() => parseLayout(invalid)).toThrow(InvalidLayoutError);
    });

    it("should throw InvalidLayoutError for negative rInner in arc", () => {
      const invalid = {
        schemaVersion: 1,
        name: "Invalid Arc",
        sections: [
          {
            type: "arc",
            id: "A1",
            center: { x: 0, y: 0 },
            thetaStart: 0,
            thetaEnd: 180,
            rInner: -50, // Invalid!
            rowGap: 20,
            rows: 2,
            seatWidth: 20,
            gapX: 5,
          },
        ],
        seats: [],
      };

      expect(() => parseLayout(invalid)).toThrow(InvalidLayoutError);
    });

    it("should throw InvalidLayoutError for invalid JSON string", () => {
      expect(() => parseLayout("{ malformed json")).toThrow(InvalidLayoutError);
    });

    it("should serialize an internal layout back to degrees", () => {
      const internal = {
        schemaVersion: 1 as const,
        name: "Test Layout",
        sections: [],
        seats: [
          {
            id: "SEC-A-1",
            x: 10,
            y: 20,
            rotation: Math.PI / 2, // 90 deg in radians
            sectionId: "SEC",
            row: "A",
            number: "1",
          },
        ],
      };

      const serialized = serializeLayout(internal);
      expect(serialized.seats[0].rotation).toBeCloseTo(90, 2);
    });
  });
});
