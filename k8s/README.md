# Kubernetes deployment

The frontend image is a static nginx file server. All reverse proxying is
Traefik's job — the pod never talks to the backend.

## Routing model

Both routes live on **one origin** because the SPA calls `/api` on its own host
(`VITE_API_BASE_URL` is empty in the image). Splitting them across hosts would
require CORS on the backend.

| Match                | Priority | Service            |
| -------------------- | -------- | ------------------ |
| `PathPrefix(/api)`   | 20       | `fastapi:80`       |
| `PathPrefix(/)`      | 10       | `snmp-frontend:80` |

`stripPrefix` removes `/api` before the request reaches the backend: the API
serves its contract at the root (`/machines`, not `/api/machines`), and the
prefix exists only so one origin can carry both. Drop that middleware if the
backend is started with `root_path=/api` instead — then it expects the prefix to
arrive intact, and the image must be built with `VITE_API_PREFIX=/api` either
way.

The rules carry no `Host(...)` matcher, so this router answers on any host
reaching the `web` entryPoint. That is what makes it work over the raw
LoadBalancer IP. Add `Host(\`your.domain\`) && ...` to both rules once a real
hostname exists — without it, the `PathPrefix(/)` catch-all will fight any other
IngressRoute on the same entryPoint that also lacks a host matcher.

## Before applying

1. `k8s/ingressroute.yaml` — confirm the backend Service name and port
   (`fastapi:80` here) match the cluster.
2. `k8s/kustomization.yaml` — set the image tag, and the namespace if not
   `default`.
3. Traefik v2 clusters: change `traefik.io/v1alpha1` to
   `traefik.containo.us/v1alpha1`.

```sh
kubectl apply -k k8s
```

## SSE

`/api/metrics/stream` and `/api/machines/{mac}/metrics/stream` are long-lived
event streams. Two things keep them flowing:

- `responseForwarding.flushInterval: 1ms` on the API route, so Traefik forwards
  events instead of holding them for its default 100ms window.
- The compress middleware excludes `text/event-stream`; compressing a stream
  buffers it and stalls the live charts.

If streams still drop, check the Traefik entryPoint's
`respondingTimeouts.idleTimeout` (default 180s) against the backend's heartbeat
interval.

## TLS

`ingressroute.yaml` ships on the `web` entryPoint so it works against a bare
Traefik install. For HTTPS, add `websecure` to `entryPoints` and uncomment the
`tls:` block, pointing `certResolver` at the cluster's resolver.

## Notes

- Pods run with a read-only root filesystem; the three `emptyDir` mounts are the
  paths nginx writes to. Capabilities are dropped to the four the stock nginx
  image actually needs.
- `/healthz` backs both probes.
- Hitting the frontend pod on `/api/*` returns a 404 JSON error on purpose —
  that means a Traefik route is misconfigured, and failing loudly beats serving
  `index.html` to a fetch that then dies in Zod.
