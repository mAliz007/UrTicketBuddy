import {
  generateGrid,
  generateArc,
  generateTableCluster,
  degToRad,
} from "../index";

describe("Math Generators", () => {
  describe("generateGrid", () => {
    it("should generate seats with correct IDs and coordinates", () => {
      const seats = generateGrid({
        origin: { x: 100, y: 100 },
        rows: 3,
        columns: 4,
        seatWidth: 20,
        gapX: 5,
        gapY: 10,
        sectionId: "SEC",
      });

      expect(seats).toHaveLength(12);
      expect(seats[0]).toEqual({
        id: "SEC-A-1",
        x: 100,
        y: 100,
        rotation: 0,
        sectionId: "SEC",
        row: "A",
        number: "1",
      });
      // Second seat in row A: x = 100 + 20 + 5 = 125
      expect(seats[1].x).toBe(125);
      expect(seats[1].y).toBe(100);

      // Row B: y = 100 + 20 + 10 = 130
      expect(seats[4].id).toBe("SEC-B-1");
      expect(seats[4].x).toBe(100);
      expect(seats[4].y).toBe(130);
    });

    it("should support staggerOffset on odd rows", () => {
      const seats = generateGrid({
        origin: { x: 0, y: 0 },
        rows: 2,
        columns: 2,
        seatWidth: 20,
        gapX: 5,
        gapY: 5,
        staggerOffset: 12.5,
        sectionId: "STAGGER",
      });

      // Row 0 (A, even): startX = 0
      expect(seats[0].x).toBe(0);
      // Row 1 (B, odd): startX = 12.5
      expect(seats[2].x).toBe(12.5);
    });

    it("should add extra aisle spacing for aisleColumns", () => {
      const seats = generateGrid({
        origin: { x: 0, y: 0 },
        rows: 1,
        columns: 4,
        seatWidth: 20,
        gapX: 5,
        gapY: 5,
        aisleColumns: [2],
        aisleWidth: 30,
        sectionId: "AISLE",
      });

      // col 0: 0
      expect(seats[0].x).toBe(0);
      // col 1: 0 + 20 + 5 = 25
      expect(seats[1].x).toBe(25);
      // col 2 is aisle: 25 + 20 + 5 + 30 = 80
      expect(seats[2].x).toBe(80);
      // col 3: 80 + 20 + 5 = 105
      expect(seats[3].x).toBe(105);
    });
  });

  describe("generateArc", () => {
    it("should generate seats along an arc facing center", () => {
      const seats = generateArc({
        center: { x: 500, y: 500 },
        thetaStart: 0,
        thetaEnd: Math.PI,
        rInner: 100,
        rowGap: 30,
        rows: 2,
        seatWidth: 20,
        gapX: 5,
        sectionId: "ARC",
      });

      expect(seats.length).toBeGreaterThan(0);
      const firstSeat = seats[0];
      expect(firstSeat.sectionId).toBe("ARC");

      // Verify rotation aligns with tangent (theta + 90 deg)
      // Vector towards center
      const dx = 500 - firstSeat.x;
      const dy = 500 - firstSeat.y;
      const radius = Math.hypot(dx, dy);
      expect(radius).toBeCloseTo(100, 0);

      // Tangent vector
      const rotRad = degToRad(firstSeat.rotation);
      const tangentX = Math.cos(rotRad);
      const tangentY = Math.sin(rotRad);
      // Tangent and center vector must be perpendicular (dot product = 0)
      const dot = (dx / radius) * tangentX + (dy / radius) * tangentY;
      expect(Math.abs(dot)).toBeLessThan(1e-3);
    });

    it("should accurately compute max seats per row formula", () => {
      const rInner = 200;
      const rowGap = 40;
      const thetaSpan = Math.PI / 2; // 90 deg
      const seatWidth = 25;
      const gapX = 5;

      const seats = generateArc({
        center: { x: 0, y: 0 },
        thetaStart: 0,
        thetaEnd: thetaSpan,
        rInner,
        rowGap,
        rows: 2,
        seatWidth,
        gapX,
        sectionId: "FORMULA",
      });

      const expectedRow0 = Math.floor(
        (rInner * thetaSpan + gapX) / (seatWidth + gapX),
      );
      const expectedRow1 = Math.floor(
        ((rInner + rowGap) * thetaSpan + gapX) / (seatWidth + gapX),
      );

      const row0Seats = seats.filter((s) => s.row === "A");
      const row1Seats = seats.filter((s) => s.row === "B");

      expect(row0Seats).toHaveLength(expectedRow0);
      expect(row1Seats).toHaveLength(expectedRow1);
    });
  });

  describe("generateTableCluster", () => {
    it("should place seats radially around table edge and return group transforms", () => {
      const result = generateTableCluster({
        center: { x: 300, y: 300 },
        tableRadius: 50,
        seatCount: 6,
        sectionId: "DINING",
        tableId: "T4",
      });

      expect(result.id).toBe("DINING-T4");
      expect(result.table.radius).toBe(50);
      expect(result.seats).toHaveLength(6);
      expect(result.transform.translate).toEqual({ dx: 300, dy: 300 });

      // Verify each seat is at distance tableRadius from center
      for (const seat of result.seats) {
        const dist = Math.hypot(seat.x - 300, seat.y - 300);
        expect(dist).toBeCloseTo(50, 2);
      }
    });
  });
});
