# realtime-leaderboard

A real-time leaderboard service — a Rust HTTP API (Axum + Tokio) backed by
PostgreSQL for durable score events and Redis sorted sets for live rankings.

## Status

**MVP features in place.** Score events are ingested durably and idempotently,
rankings are served live from Redis, and a rebuild tool re-creates the Redis
board from Postgres. See `PROJECT_CONTEXT.md` for the project brief and
`AGENTS.md` for how agents work in this repository.

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

### Ranking rebuild

Redis is a projection of Postgres. If it drifts, recreate it from the source
of truth:

```bash
cd backend
cargo run --bin rebuild     # reads DATABASE_URL and REDIS_URL
```

## Stack

- **Backend**: Rust — Axum on Tokio, queried through `sqlx`
- **Database**: PostgreSQL 16
- **Cache / ranking**: Redis 7 (sorted sets)
- **Dev environment**: Docker Compose (dev sandbox + `db` + `redis`), `mise` for toolchain pins

## Layout

```text
backend/    # Rust API: routes, services, storage, and ranking
```

## Development

```bash
make check        # fmt + clippy + test + build (no-ops until backend/Cargo.toml exists)
make dev-up       # start Postgres, Redis, and the dev sandbox
make shell        # shell inside the sandbox
make opencode     # run opencode inside the sandbox
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
