# @urticketbuddy/tester (UTB Endpoint Workbench)

A dedicated, lightweight, Postman-like API workbench built for engineers, QA, and security auditors to test, inspect, and benchmark UrTicketBuddy backend endpoints across environments without launching the full ticketing customer web SPA.

Runs on dedicated port **`5174`** (`apps/web` runs on `5173`).

---

## 🚀 Key Capabilities

1. **Pre-configured Endpoint Catalog**:
   - Complete route tree for **Authentication & RBAC**, **Venues & Seating Layouts**, **Events & Discovery**, **Seat Selection & Realtime Holds**, **Checkout & Orders**, **Tickets & Wallet**, **Gate Scanner Verification**, **Capped P2P Resale Marketplace**, **System Health & Readiness**, **Admin Suite & Fraud Control** (order flagging, ticket revocation with Redis seat restoration, commission settings, user suspension, organizer approval, immutable audit trail), and **Organizer Analytics** (revenue, velocity, capacity, hold drop-offs, resale volume).
   - Pre-populated standard request bodies, query parameters, and required HTTP headers matching Zod contract definitions.

2. **Multi-Environment Targeting**:
   - **Local API Direct**: `http://localhost:3000` (Direct NestJS monolith access).
   - **Local Edge Proxy**: `http://localhost:80` (Nginx reverse proxy validation).
   - **Live OCI Production**: `http://129.221.182.252` (Direct testing against live cloud infrastructure).
   - **Custom Origin**: Configure arbitrary host/ports for staging, review apps, or tunnel URLs.

3. **Smart Authorization & Token Propagation**:
   - Automatically parses `accessToken` / `token` from `/api/v1/auth/login` or `/api/v1/auth/register` responses.
   - Automatically populates the global Bearer token and injects it into all endpoints flagged with `requiresAuth: true`.
   - One-click Role Quick-Presets (`customer`, `organizer`, `admin`, `gate_staff`) to immediately test RBAC boundaries.

4. **Idempotency & High-Concurrency Safety**:
   - One-click UUID generation for `Idempotency-Key` headers (required on order creation and payment endpoints per ADR-0001).
   - Prevents accidental duplicate charges during rapid manual testing.

5. **Dynamic QR Code Visualizer**:
   - Detects dynamic HMAC-SHA256 QR tokens returned by `/api/v1/tickets/:id/qr` and renders live scannable SVG QR codes in the response pane.
   - Allows gate scanner testing without needing a physical mobile phone.

6. **DevOps & History Tracking**:
   - One-click **Copy as cURL** command generator with exact headers, query parameters, and escaped JSON payloads.
   - Persistent request history stored in `localStorage` with execution latency (`ms`), status badges, and request replay capabilities.

---

## 🛠️ Getting Started

### Prerequisites

From the monorepo root:

```bash
# Install dependencies
pnpm install
```

### Running Locally

To launch the workbench on dedicated port `5174`:

```bash
# Run from repository root
pnpm tester

# Or directly within apps/tester
cd apps/tester
pnpm dev
```

Open your browser at:
👉 **`http://localhost:5174`**

### Building for Production

```bash
pnpm --filter @urticketbuddy/tester build
```

---

## 📂 Architecture & Directory Structure

```text
apps/tester/
├── index.html                  # HTML entrypoint
├── package.json                # Package manifest (@urticketbuddy/tester)
├── vite.config.ts              # Vite config pinned to port 5174
├── tsconfig.json               # TypeScript configuration extending packages/config
├── tailwind.config.js          # Tailwind CSS styling configuration
├── postcss.config.js           # PostCSS setup
└── src/
    ├── main.tsx                # Application bootstrapping
    ├── App.tsx                 # Root state coordinator (history, tokens, environments)
    ├── types.ts                # TypeScript interfaces for requests, responses, endpoints
    ├── index.css               # Global dark-theme styles & scrollbar formatting
    ├── data/
    │   └── endpoints.ts        # Comprehensive catalog of UrTicketBuddy REST endpoints
    ├── utils/
    │   ├── curl.ts             # Shell-safe cURL command generator
    │   └── storage.ts          # LocalStorage persistence for tokens, environments, history
    └── components/
        ├── Header.tsx          # Top navigation: Env selector, token manager, role presets, cURL
        ├── Sidebar.tsx         # Filterable endpoints catalog & historical requests drawer
        ├── RequestEditor.tsx   # Method, URL bar, path variables, params, headers, body tabs
        ├── ResponseViewer.tsx  # Status badges, timing, JSON viewer, headers, raw output
        └── QRVisualizer.tsx    # Live dynamic SVG QR code generator & token viewer
```

---

## 🔒 Security & Best Practices

- **Zero Secret Commits**: Tokens and session histories are stored only in client-side browser `localStorage` and never sent to external telemetry services.
- **CORS Handling**: When testing `http://localhost:3000` directly from `http://localhost:5174`, ensure `apps/api` enables CORS for local origins (configured in `apps/api/src/main.ts`).
