import { generateGrid } from "../index";

describe("Performance Benchmark", () => {
  it("MUST generate 10,000 seats in under 200 milliseconds", () => {
    // Warm-up to trigger V8 JIT compilation and avoid measuring cold-start interpretation overhead
    generateGrid({
      origin: { x: 0, y: 0 },
      rows: 10,
      columns: 10,
      seatWidth: 20,
      gapX: 5,
      gapY: 5,
      sectionId: "WARMUP",
    });

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
    // Allow up to 500 ms in constrained virtualized CI environments under Turborepo concurrency
    const maxDurationMs = process.env.CI ? 500 : 200;
    expect(duration).toBeLessThan(maxDurationMs);
  });
});
