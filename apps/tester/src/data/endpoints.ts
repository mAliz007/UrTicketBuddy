import { EndpointCategory } from "../types";

export const ENDPOINT_CATEGORIES: EndpointCategory[] = [
  {
    name: "Authentication & Identity",
    description:
      "User registration, authentication, JWT tokens, profile and RBAC",
    endpoints: [
      {
        id: "auth-register",
        name: "Register User",
        description:
          "Creates a new user account with specified role (CUSTOMER, ORGANIZER, GATE_STAFF, ADMIN)",
        category: "Authentication & Identity",
        method: "POST",
        path: "/api/v1/auth/register",
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            email: `fan_${Date.now()}@example.com`,
            password: "Password123!",
            firstName: "Concert",
            lastName: "Fan",
            role: "CUSTOMER",
          },
          null,
          2,
        ),
      },
      {
        id: "auth-login",
        name: "User Login",
        description:
          "Authenticates with credentials and returns accessToken and refreshToken",
        category: "Authentication & Identity",
        method: "POST",
        path: "/api/v1/auth/login",
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            email: "fan@example.com",
            password: "Password123!",
          },
          null,
          2,
        ),
      },
      {
        id: "auth-me",
        name: "Current Token Identity",
        description:
          "Retrieves identity payload from authenticated JWT Bearer token",
        category: "Authentication & Identity",
        method: "GET",
        path: "/api/v1/auth/me",
        requiresAuth: true,
      },
      {
        id: "users-me-profile",
        name: "Get User Profile",
        description: "Retrieves full user entity profile from database",
        category: "Authentication & Identity",
        method: "GET",
        path: "/api/v1/users/me/profile",
        requiresAuth: true,
      },
      {
        id: "users-update-profile",
        name: "Update User Profile",
        description: "Updates first name and last name of authenticated user",
        category: "Authentication & Identity",
        method: "PUT",
        path: "/api/v1/users/me/profile",
        requiresAuth: true,
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            firstName: "Jane",
            lastName: "Doe",
          },
          null,
          2,
        ),
      },
      {
        id: "auth-refresh",
        name: "Refresh Access Token",
        description:
          "Exchanges a valid refreshToken for a new short-lived accessToken",
        category: "Authentication & Identity",
        method: "POST",
        path: "/api/v1/auth/refresh",
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            refreshToken: "PASTE_YOUR_REFRESH_TOKEN_HERE",
          },
          null,
          2,
        ),
      },
      {
        id: "auth-admin-only",
        name: "Admin Only Guard Check",
        description:
          "Protected route guarded by RolesGuard requiring ADMIN role",
        category: "Authentication & Identity",
        method: "GET",
        path: "/api/v1/auth/admin-only",
        requiresAuth: true,
      },
      {
        id: "organizer-create-gate-staff",
        name: "Provision Gate Staff",
        description:
          "Allows ORGANIZER or ADMIN to create a dedicated gate staff account bound to their tenant",
        category: "Authentication & Identity",
        method: "POST",
        path: "/api/v1/organizer/gate-staff",
        requiresAuth: true,
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            email: `gatekeeper_${Date.now()}@example.com`,
            password: "Password123!",
            firstName: "Turnstile",
            lastName: "Officer",
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    name: "Venues & Parametric Layouts",
    description: "Venue creation and parametric layout retrieval",
    endpoints: [
      {
        id: "venues-create",
        name: "Create Venue",
        description:
          "Creates a new venue with linked MongoDB layout parsed by venue-engine",
        category: "Venues & Parametric Layouts",
        method: "POST",
        path: "/api/v1/venues",
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            name: "Grand Arena Lahore",
            location: "Lahore, Pakistan",
            layout: {
              schemaVersion: 1,
              name: "Grand Arena Floor",
              dimensions: { width: 1200, height: 900 },
              sections: [
                {
                  type: "grid",
                  id: "SEC-A",
                  name: "Main Floor",
                  origin: { x: 50, y: 50 },
                  rows: 5,
                  columns: 5,
                  seatWidth: 20,
                  gapX: 5,
                  gapY: 5,
                  staggerOffset: 0,
                  aisleColumns: [],
                  aisleWidth: 0,
                },
              ],
            },
          },
          null,
          2,
        ),
      },
      {
        id: "venues-get-by-id",
        name: "Get Venue by ID",
        description: "Fetches venue metadata and linked layout",
        category: "Venues & Parametric Layouts",
        method: "GET",
        path: "/api/v1/venues/:id",
        defaultParams: {
          id: "a290cb59-127e-4258-8f94-9f29751e1888",
        },
      },
    ],
  },
  {
    name: "Events & Seat Generation",
    description: "Event lifecycle and seat generation",
    endpoints: [
      {
        id: "events-create",
        name: "Create Event",
        description: "Creates a new event tied to a venue",
        category: "Events & Seat Generation",
        method: "POST",
        path: "/api/v1/events",
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            venueId: "a290cb59-127e-4258-8f94-9f29751e1888",
            name: "UrTicketBuddy Championship 2026",
            startTime: new Date(Date.now() + 86400000 * 7).toISOString(),
          },
          null,
          2,
        ),
      },
      {
        id: "events-get-by-id",
        name: "Get Event by ID",
        description: "Fetches event details including venue relation",
        category: "Events & Seat Generation",
        method: "GET",
        path: "/api/v1/events/:id",
        defaultParams: {
          id: "75e862e1-b8a8-47ce-b522-2339da39d211",
        },
      },
      {
        id: "events-generate-seats",
        name: "Generate Event Seats",
        description:
          "Generates seat inventory from venue parametric layout math",
        category: "Events & Seat Generation",
        method: "POST",
        path: "/api/v1/events/:id/generate-seats",
        defaultParams: {
          id: "75e862e1-b8a8-47ce-b522-2339da39d211",
        },
      },
    ],
  },
  {
    name: "Seat Locks & Checkout",
    description: "Redis atomic seat locks and checkout finalization",
    endpoints: [
      {
        id: "checkout-hold-seats",
        name: "Hold Seats (Redis + Lua)",
        description:
          "Acquires atomic 10-minute hold on seats. Requires x-user-id header.",
        category: "Seat Locks & Checkout",
        method: "POST",
        path: "/api/v1/checkout/hold",
        defaultHeaders: {
          "Content-Type": "application/json",
          "x-user-id": "f11d3af2-5d0d-48ca-a440-198c1b74de8d",
        },
        defaultBody: JSON.stringify(
          {
            eventId: "75e862e1-b8a8-47ce-b522-2339da39d211",
            seatIds: ["SEC-A-ROW-1-SEAT-1"],
          },
          null,
          2,
        ),
      },
      {
        id: "orders-checkout",
        name: "Finalize Order Checkout",
        description:
          "Confirms order, charges minor units, writes tickets to PostgreSQL. Requires Idempotency-Key.",
        category: "Seat Locks & Checkout",
        method: "POST",
        path: "/api/v1/orders/checkout",
        requiresIdempotency: true,
        defaultHeaders: {
          "Content-Type": "application/json",
          "x-user-id": "f11d3af2-5d0d-48ca-a440-198c1b74de8d",
        },
        defaultBody: JSON.stringify(
          {
            userId: "f11d3af2-5d0d-48ca-a440-198c1b74de8d",
            eventId: "75e862e1-b8a8-47ce-b522-2339da39d211",
            items: [
              {
                eventSeatId: "s0000000-0000-0000-0000-000000000001",
                price: 1500,
              },
            ],
          },
          null,
          2,
        ),
      },
      {
        id: "orders-get-by-id",
        name: "Get Order by ID",
        description: "Retrieves order status and associated items",
        category: "Seat Locks & Checkout",
        method: "GET",
        path: "/api/v1/orders/:id",
        defaultParams: {
          id: "ord-test-123",
        },
      },
    ],
  },
  {
    name: "Tickets & Gate Turnstile",
    description: "Dynamic QR tickets, key rotation, and turnstile validation",
    endpoints: [
      {
        id: "tickets-my-tickets",
        name: "My Tickets (Wallet)",
        description:
          "Retrieves all issued tickets owned by the authenticated caller",
        category: "Tickets & Gate Turnstile",
        method: "GET",
        path: "/api/v1/users/me/tickets",
        requiresAuth: true,
      },
      {
        id: "tickets-get-dynamic-qr",
        name: "Get Dynamic Ticket QR Token",
        description:
          "Generates time-decaying HMAC-SHA256 token valid for 30 seconds",
        category: "Tickets & Gate Turnstile",
        method: "GET",
        path: "/api/v1/tickets/:ticketId/dynamic-qr",
        requiresAuth: true,
        defaultParams: {
          ticketId: "t0000000-0000-0000-0000-000000000001",
        },
      },
      {
        id: "gate-scan-ticket",
        name: "Scan Ticket at Gate",
        description:
          "Validates HMAC-SHA256 QR token, checks Bloom filter, and marks ticket CHECKED_IN",
        category: "Tickets & Gate Turnstile",
        method: "POST",
        path: "/api/v1/gate/scan",
        requiresAuth: true,
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            token: "PASTE_TOKEN_FROM_DYNAMIC_QR_HERE",
            eventId: "75e862e1-b8a8-47ce-b522-2339da39d211",
          },
          null,
          2,
        ),
      },
      {
        id: "gate-get-metrics",
        name: "Gate Entry Velocity Metrics",
        description:
          "Returns scan metrics, entry velocity per minute, and check-in totals",
        category: "Tickets & Gate Turnstile",
        method: "GET",
        path: "/api/v1/gate/metrics",
        requiresAuth: true,
        defaultParams: {
          eventId: "75e862e1-b8a8-47ce-b522-2339da39d211",
        },
      },
      {
        id: "tickets-rotate-key",
        name: "Rotate Ticket Master Key",
        description:
          "Admin operation: increments ticket seedVersion and invalidates old QR tokens",
        category: "Tickets & Gate Turnstile",
        method: "PATCH",
        path: "/api/v1/tickets/:ticketId/rotate-key",
        requiresAuth: true,
        defaultParams: {
          ticketId: "t0000000-0000-0000-0000-000000000001",
        },
      },
    ],
  },
  {
    name: "Capped P2P Resale Marketplace",
    description:
      "Capped 110% resale listings, distributed locking, and ledger transfer",
    endpoints: [
      {
        id: "resale-create-listing",
        name: "List Ticket for Resale",
        description:
          "Lists an ISSUED ticket for resale capped at 110% of face value",
        category: "Capped P2P Resale Marketplace",
        method: "POST",
        path: "/api/v1/resale/listings",
        requiresAuth: true,
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            ticketId: "t0000000-0000-0000-0000-000000000001",
            askingPriceMinor: 11000,
          },
          null,
          2,
        ),
      },
      {
        id: "resale-update-listing",
        name: "Update or Withdraw Listing",
        description:
          "Seller operation: lowers asking price or withdraws an active resale listing",
        category: "Capped P2P Resale Marketplace",
        method: "PATCH",
        path: "/api/v1/resale/listings/:listingId",
        requiresAuth: true,
        defaultParams: {
          listingId: "l0000000-0000-0000-0000-000000000001",
        },
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            askingPriceMinor: 10500,
          },
          null,
          2,
        ),
      },
      {
        id: "resale-get-listings",
        name: "Browse Active Resale Listings",
        description:
          "Public endpoint: returns paginated active listings for upcoming events",
        category: "Capped P2P Resale Marketplace",
        method: "GET",
        path: "/api/v1/resale/listings",
        defaultParams: {
          page: "1",
          pageSize: "20",
        },
      },
      {
        id: "resale-purchase-listing",
        name: "Purchase Resale Listing",
        description:
          "Atomic purchase: acquires Redis lock, charges buyer, splits ledger, transfers ownership, rotates QR seed",
        category: "Capped P2P Resale Marketplace",
        method: "POST",
        path: "/api/v1/resale/listings/:listingId/purchase",
        requiresAuth: true,
        defaultParams: {
          listingId: "l0000000-0000-0000-0000-000000000001",
        },
        defaultHeaders: {
          "Content-Type": "application/json",
          "Idempotency-Key": `idem-resale-${Date.now()}`,
        },
        defaultBody: JSON.stringify(
          {
            paymentMethodToken: "tok_visa",
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    name: "System Health & Ingress",
    description: "Liveness and readiness checks for services and dependencies",
    endpoints: [
      {
        id: "health-api",
        name: "Core API Health & Dependencies",
        description:
          "Reports connectivity to PostgreSQL, PgBouncer, MongoDB, Redis, and Elasticsearch",
        category: "System Health & Ingress",
        method: "GET",
        path: "/api/v1/health",
      },
      {
        id: "health-root",
        name: "Root Ingress Health Check",
        description: "Checks edge proxy mapping to backend services",
        category: "System Health & Ingress",
        method: "GET",
        path: "/health",
      },
    ],
  },
  {
    name: "Admin Suite & Fraud Control",
    description:
      "System administration, fraud mitigation, ticket revocation with seat recovery, immutable audit trail, and platform settings",
    endpoints: [
      {
        id: "admin-flag-order",
        name: "Flag Order as Fraudulent",
        description:
          "Marks order status as FLAGGED and increments seedVersion on all tickets transactionally to invalidate HMAC QR tokens",
        category: "Admin Suite & Fraud Control",
        method: "PATCH",
        path: "/api/v1/admin/orders/:orderId/flag",
        requiresAuth: true,
        defaultParams: {
          orderId: "60000000-0000-0000-0000-000000000001",
        },
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            reason: "Suspected credit card fraud reported by cardholder",
          },
          null,
          2,
        ),
      },
      {
        id: "admin-revoke-ticket",
        name: "Revoke Ticket & Restore Seat",
        description:
          "Revokes ticket (REVOKED), increments seedVersion, resets seat to AVAILABLE in Postgres, removes from Redis sold set, and broadcasts availability on seat-updates:{eventId}",
        category: "Admin Suite & Fraud Control",
        method: "DELETE",
        path: "/api/v1/admin/tickets/:ticketId",
        requiresAuth: true,
        defaultParams: {
          ticketId: "70000000-0000-0000-0000-000000000001",
        },
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            reason: "Duplicate chargeback dispute upheld by payment processor",
          },
          null,
          2,
        ),
      },
      {
        id: "admin-get-commission",
        name: "Get Platform Commission Rate",
        description:
          "Reads global platform commission rate percent (backed by PlatformSettingsPort and platform_settings table)",
        category: "Admin Suite & Fraud Control",
        method: "GET",
        path: "/api/v1/admin/settings/commission",
        requiresAuth: true,
      },
      {
        id: "admin-update-commission",
        name: "Update Platform Commission Rate",
        description:
          "Updates global platform commission rate percentage (0% to 50%) and appends immutable audit log",
        category: "Admin Suite & Fraud Control",
        method: "PUT",
        path: "/api/v1/admin/settings/commission",
        requiresAuth: true,
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            commissionRatePercent: 12,
          },
          null,
          2,
        ),
      },
      {
        id: "admin-suspend-user",
        name: "Suspend User Account",
        description:
          "Suspends user account (isSuspended = true), immediately revokes all active refresh tokens, and writes audit record",
        category: "Admin Suite & Fraud Control",
        method: "PATCH",
        path: "/api/v1/admin/users/:userId/suspend",
        requiresAuth: true,
        defaultParams: {
          userId: "30000000-0000-0000-0000-000000000001",
        },
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            reason:
              "Terms of service violation - automated scalping bot detected",
          },
          null,
          2,
        ),
      },
      {
        id: "admin-approve-organizer",
        name: "Approve Organizer Tenant",
        description:
          "Promotes user to ORGANIZER role, provisions tenant identifier, and logs admin approval action",
        category: "Admin Suite & Fraud Control",
        method: "PATCH",
        path: "/api/v1/admin/organizers/:userId/approve",
        requiresAuth: true,
        defaultParams: {
          userId: "20000000-0000-0000-0000-000000000002",
        },
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        defaultBody: JSON.stringify(
          {
            reason: "KYC credentials and venue host documentation verified",
          },
          null,
          2,
        ),
      },
      {
        id: "admin-get-audit-logs",
        name: "Query Append-Only Audit Trail",
        description:
          "Queries paginated immutable audit logs with optional filtering by action, actorId, and entityType",
        category: "Admin Suite & Fraud Control",
        method: "GET",
        path: "/api/v1/admin/audit-logs",
        requiresAuth: true,
        defaultParams: {
          page: "1",
          pageSize: "20",
          action: "ORDER_FLAGGED",
        },
      },
    ],
  },
  {
    name: "Organizer Analytics",
    description:
      "Real-time event performance, revenue metrics, 5-minute gate entry throughput, Redis seat locks, and secondary resale turnover",
    endpoints: [
      {
        id: "organizer-get-analytics",
        name: "Get Event Performance & Revenue Analytics",
        description:
          "Returns minor-unit gross revenue, sold ticket counts, venue capacity, occupancy rate, 5-minute bucket entry velocity, Redis hold counts, and resale volume (tenant isolated for ORGANIZER, unrestricted for ADMIN)",
        category: "Organizer Analytics",
        method: "GET",
        path: "/api/v1/organizer/analytics/:eventId",
        requiresAuth: true,
        defaultParams: {
          eventId: "40000000-0000-0000-0000-000000000001",
        },
      },
    ],
  },
];
