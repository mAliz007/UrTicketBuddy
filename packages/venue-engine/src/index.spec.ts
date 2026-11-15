import { generateGridSeats, generateRadialSeats } from "./index";

describe("packages/venue-engine layout math", () => {
  it("should generate grid seats with correct IDs (<sectionId>-<row>-<number>)", () => {
    const seats = generateGridSeats({
      sectionId: "SEC1",
      startX: 0,
      startY: 0,
      rows: 2,
      seatsPerRow: 3,
      seatSpacing: 10,
      rowSpacing: 20,
    });

    expect(seats).toHaveLength(6);
    expect(seats[0].seatId).toBe("SEC1-A-1");
    expect(seats[0].x).toBe(0);
    expect(seats[0].y).toBe(0);
    expect(seats[5].seatId).toBe("SEC1-B-3");
    expect(seats[5].x).toBe(20);
    expect(seats[5].y).toBe(20);
  });

  it("should generate radial seats with correct trigonometry", () => {
    const seats = generateRadialSeats({
      sectionId: "ARC",
      centerX: 100,
      centerY: 100,
      startRadius: 50,
      radiusStep: 10,
      startAngleDeg: 0,
      endAngleDeg: 90,
      rows: 1,
      seatsPerRow: 2,
    });

    expect(seats).toHaveLength(2);
    expect(seats[0].seatId).toBe("ARC-A-1");
    expect(seats[0].x).toBe(150);
    expect(seats[0].y).toBe(100);
    expect(seats[1].seatId).toBe("ARC-A-2");
    expect(seats[1].x).toBe(100);
    expect(seats[1].y).toBe(150);
  });
});
