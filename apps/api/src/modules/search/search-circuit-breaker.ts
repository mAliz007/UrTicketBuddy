export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  now?: () => number;
}

export class SearchCircuitBreaker {
  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 3);
    this.cooldownMs = Math.max(1, options.cooldownMs ?? 30_000);
    this.now = options.now ?? (() => Date.now());
  }

  getState(): CircuitState {
    if (this.state === "OPEN" && this.openedAt !== null) {
      if (this.now() - this.openedAt >= this.cooldownMs) {
        this.state = "HALF_OPEN";
      }
    }
    return this.state;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  canAttempt(): boolean {
    const current = this.getState();
    return current === "CLOSED" || current === "HALF_OPEN";
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.state = "CLOSED";
  }

  recordFailure(): void {
    const current = this.getState();
    if (current === "HALF_OPEN") {
      this.state = "OPEN";
      this.openedAt = this.now();
      this.consecutiveFailures = this.failureThreshold;
      return;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = this.now();
    }
  }

  reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }
}
