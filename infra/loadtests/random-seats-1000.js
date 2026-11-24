import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { SharedArray } from "k6/data";
import exec from "k6/execution";

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3000";
const TOTAL_VUS = Number(__ENV.VUS || 1000);
const DURATION = __ENV.DURATION || "30s";

const seedData = JSON.parse(open("./users.json"));
const EVENT_ID = __ENV.EVENT_ID || seedData.eventId;
const users = new SharedArray("virtual_users", () => seedData.users);

export const holdsSucceeded = new Counter("random_holds_succeeded");
export const holdsConflicted = new Counter("random_holds_conflicted");
export const serverErrors = new Counter("server_errors");

export const options = {
  scenarios: {
    random_seat_selection: {
      executor: "constant-vus",
      vus: TOTAL_VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<250"],
    server_errors: ["count==0"],
  },
};

function pickRandomSeats(count) {
  const chosen = new Set();
  while (chosen.size < count) {
    const row = Math.floor(Math.random() * 50) + 1;
    const col = Math.floor(Math.random() * 100) + 1;
    chosen.add(`SEC-A-${row}-${col}`);
  }
  return Array.from(chosen);
}

export default function () {
  const vuIndex = (exec.vu.idInTest - 1) % users.length;
  const user = users[vuIndex];
  const seatCount = Math.floor(Math.random() * 4) + 1; // 1 to 4 seats
  const seatIds = pickRandomSeats(seatCount);

  const res = http.post(
    `${BASE_URL}/api/v1/checkout/hold`,
    JSON.stringify({
      eventId: EVENT_ID,
      seatIds,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
        "x-user-id": user.userId,
      },
    },
  );

  if (res.status === 201) {
    holdsSucceeded.add(1);
  } else if (res.status === 409) {
    holdsConflicted.add(1);
  } else if (res.status >= 500) {
    serverErrors.add(1);
  }

  check(res, {
    "status is 201 or 409": (r) => r.status === 201 || r.status === 409,
    "no 5xx errors": (r) => r.status < 500,
  });

  sleep(0.1);
}
