import { generateGrid } from "../index";

describe("Performance Benchmark", () => {
  it("MUST generate 10,000 seats in under 200 milliseconds", () => {
    const startTime = performance.now();

    const seats = generateGrid({
      origin: { x: 0, y: 0 },
      rows: 100,
      columns: 100,
      seatWidth: 20,
      gapX: 5,
      gapY: 5,
      sectionId: "PERF_SEC",
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(seats).toHaveLength(10000);
    // MUST fail if execution time exceeds 200 ms
    expect(duration).toBeLessThan(200);
  });
});
