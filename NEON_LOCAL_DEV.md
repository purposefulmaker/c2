# Neon-style local Postgres for dev

This repo now includes a simple local Postgres service via Docker Compose and keeps the door open to add Neon's local HTTP/WebSocket proxy later.

## What you get now

- `postgres` running Postgres 17 on host port `5442` (container `5432`)
- persistent volume `postgres-data`
- `c2-backend` wired to this DB using SQLAlchemy async + `asyncpg`

Connection strings:

- Inside Docker network: `postgresql+asyncpg://c2:devpassword@postgres:5432/c2_local`
- From your host: `postgresql://c2:devpassword@localhost:5442/c2_local`

## Run it

- Start the stack: `docker compose up -d --build`
- (Optional) Connect from psql: `psql postgresql://c2:devpassword@localhost:5442/c2_local`

## Using the Neon serverless driver (optional)
If you want HTTP/WebSocket connections compatible with serverless/edge, add `@neondatabase/serverless` to your Node service and (optionally) run Neon's local wsproxy to front your local Postgres.

Example (HTTP mode):

```ts
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!); // e.g., 'postgresql://c2:devpassword@localhost:5442/c2_local'
const rows = await sql`SELECT now()`;
```

To emulate Neon’s HTTP/WebSocket locally, run wsproxy (optional):

```yaml
# docker-compose snippet (not enabled by default)
#  neon-wsproxy:
#    image: ghcr.io/neondatabase/wsproxy:latest
#    container_name: neon-wsproxy
#    environment:
#      - LISTEN=0.0.0.0:4444
#      - PGHOST=postgres
#      - PGPORT=5432
#      - PGUSER=c2
#      - PGPASSWORD=devpassword
#      - PGDATABASE=c2_local
#    ports:
#      - "4444:4444"
#    depends_on:
#      - postgres
```
Then your `DATABASE_URL` can be:

- HTTP: `postgresql://c2:devpassword@localhost:4444/c2_local`
- WebSocket with Pool/Client: set `neonConfig.webSocketConstructor = require('ws')` in Node, then use `new Pool({ connectionString: ... })`.

## Azure SSO via LocalTunnel note
`auth-service` now sets `AUTH_PUBLIC_URL=https://c2-auth.loca.lt` in compose so cookies use `SameSite=None; Secure` when behind HTTPS via LocalTunnel. Keep `FRONTEND_URL=http://localhost:3006`.

If you change your tunnel subdomain, update `AUTH_PUBLIC_URL` accordingly and restart: `docker compose up -d auth-service`.
