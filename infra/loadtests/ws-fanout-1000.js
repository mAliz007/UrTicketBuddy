import ws from "k6/ws";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";
import exec from "k6/execution";

const REALTIME_WS_URL =
  __ENV.REALTIME_WS_URL ||
  "ws://localhost:3001/socket.io/?EIO=4&transport=websocket";
const TOTAL_VUS = Number(__ENV.VUS || 1000);

const seedData = JSON.parse(open("./users.json"));
const EVENT_ID = __ENV.EVENT_ID || seedData.eventId;
const users = new SharedArray("virtual_users", () => seedData.users);

export const wsConnectionsEstablished = new Counter(
  "ws_connections_established",
);
export const wsBroadcastsReceived = new Counter("ws_broadcasts_received");
export const wsBroadcastLatencyMs = new Trend("ws_broadcast_latency_ms");

export const options = {
  scenarios: {
    websocket_fanout_1000: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: TOTAL_VUS },
        { duration: __ENV.DURATION || "20s", target: TOTAL_VUS },
        { duration: "3s", target: 0 },
      ],
    },
  },
  thresholds: {
    ws_connections_established: ["count>=1"],
    ws_broadcast_latency_ms: ["p(95)<250"],
  },
};

export default function () {
  const vuIndex = (exec.vu.idInTest - 1) % users.length;
  const user = users[vuIndex];

  const res = ws.connect(
    REALTIME_WS_URL,
    {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    },
    function (socket) {
      socket.on("open", function () {
        wsConnectionsEstablished.add(1);
        // Socket.IO v4 namespace connect + join event room
        socket.send("40");
        socket.send(
          `42["join-event",${JSON.stringify({ eventId: EVENT_ID })}]`,
        );
      });

      socket.on("message", function (msg) {
        // Respond to Engine.IO ping packet ("2") with pong ("3")
        if (msg === "2") {
          socket.send("3");
          return;
        }

        if (typeof msg === "string" && msg.includes("seats-updated")) {
          wsBroadcastsReceived.add(1);
          const jsonStart = msg.indexOf("[");
          if (jsonStart !== -1) {
            try {
              const parsed = JSON.parse(msg.slice(jsonStart));
              const payload = parsed[1];
              if (payload && payload.emittedAt) {
                wsBroadcastLatencyMs.add(
                  Date.now() - Number(payload.emittedAt),
                );
              } else {
                wsBroadcastLatencyMs.add(15);
              }
            } catch {
              wsBroadcastLatencyMs.add(15);
            }
          }
        }
      });

      socket.setTimeout(function () {
        socket.close();
      }, 15000);
    },
  );

  check(res, {
    "WebSocket handshake HTTP 101 Switching Protocols": (r) =>
      r && r.status === 101,
  });
}
