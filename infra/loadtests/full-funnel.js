import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";
import exec from "k6/execution";

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3000";
const TOTAL_VUS = Number(__ENV.VUS || 1000);

const seedData = JSON.parse(open("./users.json"));
const EVENT_ID = __ENV.EVENT_ID || seedData.eventId;
const users = new SharedArray("virtual_users", () => seedData.users);

export const funnelHoldsWon = new Counter("funnel_holds_won");
export const funnelOrdersCompleted = new Counter("funnel_orders_completed");
export const funnelConflicts = new Counter("funnel_conflicts");
export const funnelServerErrors = new Counter("funnel_server_errors");
export const checkoutLatencyMs = new Trend("checkout_latency_ms");

export const options = {
  scenarios: {
    hold_to_order_funnel: {
      executor: "per-vu-iterations",
      vus: TOTAL_VUS,
      iterations: 1,
      maxDuration: "60s",
    },
  },
  thresholds: {
    funnel_server_errors: ["count==0"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const vuId = exec.vu.idInTest;
  const user = users[(vuId - 1) % users.length];

  // Deterministically map VUs across the 5,000-seat arena with realistic contention
  const row = ((vuId - 1) % 50) + 1;
  const col = (Math.floor((vuId - 1) / 50) % 100) + 1;
  const targetSeat = `SEC-A-${row}-${col}`;

  const holdRes = http.post(
    `${BASE_URL}/api/v1/checkout/hold`,
    JSON.stringify({
      eventId: EVENT_ID,
      seatIds: [targetSeat],
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
        "x-user-id": user.userId,
      },
    },
  );

  if (holdRes.status >= 500) {
    funnelServerErrors.add(1);
    return;
  }

  if (holdRes.status === 409) {
    funnelConflicts.add(1);
    return;
  }

  check(holdRes, {
    "hold succeeded with 201": (r) => r.status === 201,
  });
  funnelHoldsWon.add(1);

  const checkoutStart = Date.now();
  const idempotencyKey = `k6-funnel-${EVENT_ID}-${user.userId}-${vuId}`;
  const checkoutRes = http.post(
    `${BASE_URL}/api/v1/orders/checkout`,
    JSON.stringify({
      eventId: EVENT_ID,
      seatIds: [targetSeat],
      paymentMethodToken: "tok_visa",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
        "x-user-id": user.userId,
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
  checkoutLatencyMs.add(Date.now() - checkoutStart);

  if (checkoutRes.status === 201) {
    funnelOrdersCompleted.add(1);
  } else if (checkoutRes.status === 409) {
    funnelConflicts.add(1);
  } else if (checkoutRes.status >= 500) {
    funnelServerErrors.add(1);
  }

  check(checkoutRes, {
    "checkout completed with 201": (r) => r.status === 201,
    "zero checkout 5xx errors": (r) => r.status < 500,
  });
}
