import { SearchCircuitBreaker } from "./search-circuit-breaker";

describe("SearchCircuitBreaker", () => {
  it("opens after N consecutive failures, blocks during cooldown, and recovers via HALF_OPEN", () => {
    let now = 1_000;
    const cb = new SearchCircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 10_000,
      now: () => now,
    });

    expect(cb.getState()).toBe("CLOSED");
    expect(cb.canAttempt()).toBe(true);

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.getConsecutiveFailures()).toBe(2);

    // A success resets failure count
    cb.recordSuccess();
    expect(cb.getConsecutiveFailures()).toBe(0);

    // 3 consecutive failures open the circuit
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    expect(cb.canAttempt()).toBe(false);

    // Still open before cooldown expires
    now += 9_999;
    expect(cb.getState()).toBe("OPEN");
    expect(cb.canAttempt()).toBe(false);

    // Transitions to HALF_OPEN once cooldown elapses
    now += 1;
    expect(cb.getState()).toBe("HALF_OPEN");
    expect(cb.canAttempt()).toBe(true);

    // Failure in HALF_OPEN re-opens immediately
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    expect(cb.canAttempt()).toBe(false);

    // Advance past second cooldown and recover on success
    now += 10_000;
    expect(cb.getState()).toBe("HALF_OPEN");
    cb.recordSuccess();
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.getConsecutiveFailures()).toBe(0);
    expect(cb.canAttempt()).toBe(true);
  });
});
