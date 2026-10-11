# realtime-leaderboard

A real-time leaderboard service — a Rust HTTP API (Axum + Tokio) backed by
PostgreSQL for durable score events and Redis sorted sets for live rankings.

## Status

**Scaffold only.** The AI-agent workflow configuration ships before the
application code; the first features land as their own issues. See
`PROJECT_CONTEXT.md` for the project brief and `AGENTS.md` for how agents work
in this repository.

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
