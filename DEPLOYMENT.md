# C2 Platform Deployment Guide

This guide shows how to run locally on Windows, deploy on RHEL with Podman/OpenShift, and run on Proxmox with LXC + Docker.

## Services and Ports

- auth-service (OIDC/OAuth2): `8085`
- c2-backend (FastAPI): `8000`
- c2-frontend (Next.js): `3000`
- bun-websocket (Bun WS/UDP): `3001` (plus UDP if used)
- onvif-wrapper: `8082`
- slew2-driver: `8090`
- dragonfly (Redis-compatible): `6379`

## Local on Windows (Docker Desktop)

1. Start stack:

   ```powershell
   cd c:\apps\_TO_GIT____\c2
   docker compose up -d --build
   ```

2. Configure Azure SSO one-time setup:
   - Set `SETUP_TOKEN` in `services/auth-service/.env`.
   - Call `POST http://localhost:8085/setup/azure` with header `x-setup-token` and your Azure config.

3. Test:
   - Frontend: `http://localhost:3000`
   - API: `http://localhost:8000/health`
   - Auth: `http://localhost:8085/auth/azure`

## RHEL + Podman

- Podman can run compose files via `podman-compose` (or `podman play kube` with generated K8s YAML).

### Option A: podman-compose

```bash
sudo dnf install -y podman podman-compose
cd /opt/c2
podman-compose up -d
```

Notes:

- Replace volume paths and ensure ports are allowed through firewalld/SELinux contexts as needed.
- Use `REDIS_HOST=dragonfly` internally, but when accessing from host, use mapped ports.

### Option B: Generate K8s YAML and `podman play kube`

```bash
# Install docker-compose-to-k8s converter or write minimal K8s manifests
# Then
podman play kube c2-k8s.yaml
```

## OpenShift (OKD)

- Create `Deployment`, `Service`, and `Route` for each component.
- Store secrets (`AZURE_CLIENT_SECRET`, `JWT_SECRET`, `SESSION_SECRET`) in `Secret` objects.
- Use `Route` to expose `auth-service` and `c2-frontend` with TLS.
- Configure Azure redirect URI to the `auth-service` route URL + `/auth/azure/callback`.

## Proxmox + LXC + Docker Engine

- Create an LXC container (Ubuntu/RHEL derivative) with nesting enabled.
- Install Docker Engine inside the LXC.
- Clone repo into the LXC and run `docker compose up -d --build`.
- Expose required ports via Proxmox NAT or bridge networking.
- For a 4–5 container footprint, keep:
  - `dragonfly`, `auth-service`, `c2-backend`, `c2-frontend`, and optional `bun-websocket`.
- Add `onvif-wrapper` and `slew2-driver` only if you need those integrations in that environment.

## Environment and Secrets

- `services/auth-service/.env`: set `SETUP_TOKEN`, `SESSION_SECRET`, `JWT_SECRET`, and `FRONTEND_URL`.
- Azure: add both local and hosted redirect URIs in App Registration.
- Prefer App Roles for claims mapping to avoid group overage.

## Health and Status

- `http://localhost:8000/health` — backend
- `http://localhost:8085/setup/status` — auth setup status
- `GET /api/vendor/status` on backend — checks vendor services and Redis

## Differences: RHEL/Podman vs Proxmox/LXC

- RHEL/Podman/OpenShift:
  - Rootless containers, SELinux, `podman generate kube` for manifests, OpenShift Routes for TLS/ingress.
  - Good for enterprise-grade multi-tenant clusters.
- Proxmox/LXC + Docker:
  - Lightweight virtualization, fast spin-up, simpler homelab/edge style.
  - Use LXC nesting and a single compose file per LXC.

## Next Steps

- Add CI/CD: build and push images per service.
- Add TLS (Caddy/Traefik/Nginx) reverse proxy in front of frontend and auth-service.
- Add monitoring (Prometheus/Grafana) and log aggregation as needed.
