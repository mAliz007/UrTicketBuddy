# @urticketbuddy/web

Frontend single-page application for the UrTicketBuddy high-concurrency event ticketing platform.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Canvas / Parametric Venue Builder**: Konva (`react-konva`)

---

## Ports & Endpoints

| Environment         | Host Port | Routing / Access                                                     |
| :------------------ | :-------- | :------------------------------------------------------------------- |
| **Local Dev**       | `5173`    | [http://localhost:5173](http://localhost:5173) (Vite HMR)            |
| **Local Proxy**     | `80`      | [http://localhost:80](http://localhost:80) (via Nginx edge proxy)    |
| **Live Production** | `80`      | [http://129.221.182.252/](http://129.221.182.252/) (OCI Always Free) |

---

## Production Containerization & Routing

The web application is containerized using a two-stage Alpine Dockerfile ([`apps/web/Dockerfile`](Dockerfile)):

1. **Build Stage (`node:22-alpine`)**:
   - Compiles static assets using `pnpm --filter @urticketbuddy/web build`.
   - Output bundle is placed into `apps/web/dist/`.

2. **Runner Stage (`nginx:alpine`)**:
   - Static HTML, JS, and CSS assets are copied to `/usr/share/nginx/html`.
   - Nginx is configured with SPA client-side fallback routing:
     ```nginx
     location / {
         try_files $uri $uri/ /index.html;
     }
     ```
   - In production orchestration ([`docker-compose.prod.yml`](../../docker-compose.prod.yml)), the `web` container runs on internal port 80 and is served at `/` through the edge reverse proxy.

---

## Directory Structure

- `src/features/<feature>`: Feature modules (auth, events, seat-map, checkout, wallet, gate, etc.)
- `src/components/ui`: Reusable UI components
- `src/lib`: Client utilities, API fetch wrappers, and WebSocket connection helpers
