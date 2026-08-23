# SNMP Frontend

## Setup

```bash
cp .env.example .env
pnpm install
pnpm dev
```

`VITE_API_BASE_URL` is required and must point to the backend API origin.

## Docker

```bash
# Development: http://localhost:5173
docker compose up --build

# Production: http://localhost:8080
docker compose --profile production up --build --detach frontend-prod
```

The Makefile provides production shortcuts:

```bash
make up-prod       # Build and start
make restart-prod  # Restart
make down-prod     # Stop and remove
```

Rebuild after changing a `VITE_*` variable. Override the default ports with
`FRONTEND_DEV_PORT` and `FRONTEND_PROD_PORT`.
