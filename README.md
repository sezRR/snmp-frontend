# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## Docker Compose

Create the local environment file before starting either setup:

```bash
cp .env.example .env
```

Start the Vite development server with source files mounted for hot reload:

```bash
docker compose up --build
```

The development app is available at `http://localhost:5173` by default.

Build and start the production Nginx image instead:

```bash
docker compose --profile production up --build --detach frontend-prod
```

The production app is available at `http://localhost:8080` by default. Change
`FRONTEND_DEV_PORT` or `FRONTEND_PROD_PORT` in `.env` to use different host
ports. Vite variables are read when the production image is built, so rebuild
the image after changing `VITE_API_BASE_URL` or `VITE_API_PREFIX`.

Stop development with `docker compose down`. Stop production with
`docker compose --profile production down`.
