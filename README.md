# realtime-leaderboard

A real-time leaderboard service — a Rust HTTP API (Axum + Tokio) backed by
PostgreSQL for durable score events and Redis sorted sets for live rankings.

## Status

**MVP features in place.** Score events are ingested durably and idempotently,
rankings are served live from Redis, a rebuild tool re-creates the Redis board
from Postgres, and a React frontend exercises the three flows in a browser. See
`PROJECT_CONTEXT.md` for the project brief and `AGENTS.md` for how agents work
in this repository.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/healthz` | Liveness/readiness for Postgres and Redis |
| `POST` | `/scores` | Submit a score event (idempotent on `event_id`) |
| `GET`  | `/players/{player_id}/rank` | A player's 1-based position and best score |
| `GET`  | `/leaderboard?limit=10&offset=0` | Page through the top of the board |

`POST /scores` body: `{ "event_id": "<uuid>", "player_id": "<id>", "score": <0..=1_000_000_000> }`
— `201` on a new event, `200` with `"duplicate": true` on a replay, `400` on an
invalid payload. Scores are best-per-player; equal scores rank the earlier
event first.

### Interactive docs (OpenAPI / Swagger UI)

The API is described by an OpenAPI 3.1 document generated from the handler
annotations with [`utoipa`](https://docs.rs/utoipa), and served by the API
itself:

- **Swagger UI** — `http://localhost:8082/swagger-ui/` (host port; the container
  listens on `8080`). Every endpoint has **Try it out** against the running API.
- **Raw spec** — `http://localhost:8082/swagger-ui/api-docs/openapi.json`.

The spec is also committed as `backend/openapi.json` so it is reviewable in a
diff. Regenerate it after changing a route:

```bash
cd backend
cargo run --bin openapi     # rewrites openapi.json
```

CI runs the same command and fails if the file changes, so the document can
never drift from the code.

### Ranking rebuild

Redis is a projection of Postgres. If it drifts, recreate it from the source
of truth:

```bash
cd backend
cargo run --bin rebuild     # reads DATABASE_URL and REDIS_URL
```

## Frontend

A React + TypeScript single-page app (Vite) that submits a score, looks up a
player's rank, and shows the top of the leaderboard — against the same API
contract (`backend/openapi.json`).

```bash
cd frontend
npm ci            # install from the lockfile
npm run dev       # Vite dev server on http://localhost:5173
```

The dev server proxies the API routes to the backend, so requests are same-origin
and no CORS layer is needed. It targets `http://localhost:8080` by default (the
in-sandbox backend); on a host the API is published on `8082`, so use
`API_PROXY_TARGET=http://localhost:8082 npm run dev`. For a remote API set
`VITE_API_BASE_URL` (see the root `.env.example`). Inside the sandbox, `make dev-up`
starts it for you (or `make dev-frontend` to restart just the UI); open host port
**5173** (`WEB_HOST_PORT` to override).

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server with HMR |
| `npm test` | Vitest unit tests (React Testing Library + MSW) |
| `npm run lint` / `npm run typecheck` | oxlint / `tsc -b` |
| `npm run build` | Type-check and produce `dist/` |

## Stack

- **Backend**: Rust — Axum on Tokio, queried through `sqlx`
- **Frontend**: React 19 + TypeScript on Vite, tested with Vitest + Testing Library + MSW
- **Database**: PostgreSQL 16
- **Cache / ranking**: Redis 7 (sorted sets)
- **Dev environment**: Docker Compose (dev sandbox + `db` + `redis`), `mise` for toolchain pins

## Layout

```text
backend/    # Rust API: routes, services, storage, and ranking
frontend/   # React + TypeScript app: score submit, rank lookup, leaderboard
```

## Development

```bash
make check          # backend (fmt + clippy + test + build) and frontend (lint + typecheck + test + build)
make dev-up         # start Postgres, Redis, the dev sandbox, and the frontend (http://localhost:5173)
make dev-frontend   # (re)start just the frontend dev server
make shell          # shell inside the sandbox
make opencode       # run opencode inside the sandbox
```

Copy `.env.example` to `.env` for local (non-sandbox) runs. See `AGENTS.md` for
the full command reference and conventions.

## Workflow

Every change is tracked on GitHub: **issue → branch → PR → merge**, on a two-tier
branch model — `main` (release only) ← `dev` (integration) ← feature branches.
CI runs on `dev` → `main` PRs only; local `make check` is the feature-branch gate.

- `AGENTS.md` — operating manual for agents
- `WORKFLOW_PROMPT.md` — the development workflow prompt
- `.opencode/instructions/` — workflow, testing, and memory rules
