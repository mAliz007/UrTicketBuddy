import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { SharedArray } from "k6/data";
import exec from "k6/execution";

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3000";
const TOTAL_VUS = Number(__ENV.VUS || 1000);
const EXPECTED_CONFLICTS = TOTAL_VUS - 1;

const seedData = JSON.parse(open("./users.json"));
const EVENT_ID = __ENV.EVENT_ID || seedData.eventId;
const TARGET_SEAT_ID =
  __ENV.TARGET_SEAT_ID || seedData.targetSeatId || "SEC-A-1-1";

const users = new SharedArray("virtual_users", () => seedData.users);

export const holdsWon = new Counter("holds_won");
export const holdsConflicted = new Counter("holds_conflicted");
export const serverErrors = new Counter("server_errors");

export const options = {
  scenarios: {
    same_seat_contention: {
      executor: "per-vu-iterations",
      vus: TOTAL_VUS,
      iterations: 1,
      maxDuration: "30s",
    },
  },
  thresholds: {
    holds_won: ["count==1"],
    holds_conflicted: [`count==${EXPECTED_CONFLICTS}`],
    server_errors: ["count==0"],
    http_req_duration: ["p(95)<250"],
  },
};

export default function () {
  const vuIndex = (exec.vu.idInTest - 1) % users.length;
  const user = users[vuIndex];

  const payload = JSON.stringify({
    eventId: EVENT_ID,
    seatIds: [TARGET_SEAT_ID],
  });

  const res = http.post(`${BASE_URL}/api/v1/checkout/hold`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${user.token}`,
      "x-user-id": user.userId,
    },
  });

  if (res.status === 201) {
    holdsWon.add(1);
  } else if (res.status === 409) {
    holdsConflicted.add(1);
  } else if (res.status >= 500) {
    serverErrors.add(1);
  }

  check(res, {
    "status is 201 (winner) or 409 (conflict)": (r) =>
      r.status === 201 || r.status === 409,
    "zero 5xx server errors": (r) => r.status < 500,
  });
}
