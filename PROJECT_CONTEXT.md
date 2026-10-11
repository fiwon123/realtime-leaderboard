# PROJECT_CONTEXT.md

> Structured project identity. `AGENTS.md` is populated from this file — keep the
> two in sync. This is the brief; `AGENTS.md` is the operating manual the agents
> read first.

## Identity

- **Project**: realtime-leaderboard
- **One sentence**: A real-time leaderboard service — a Rust HTTP API backed by
  PostgreSQL and Redis that ingests score events and serves ranked leaderboards
  with low latency.

## Problem

Ranking a live stream of score events is awkward on a relational database alone:
an `ORDER BY score` over a growing table gets slower as a leaderboard heats up,
and a naive cache loses the event ordering that gives equal scores a stable
position.

## Goal

A client can submit a score event, read a player's rank, and page through the top
of a leaderboard — with the durable event stored in PostgreSQL and the live
ranking served from Redis sorted sets.

## Stack

- **Backend**: Rust (Axum on Tokio)
- **Database**: PostgreSQL
- **Query layer**: sqlx (compile-time-checked SQL)
- **Cache / ranking**: Redis (sorted sets)
- **Frontend**: planned, not yet configured (see Notes)
- **Dev environment**: Docker Compose, with a `mise` toolchain pin

## Topology

The single source of truth for the Makefile, CI, and Dependabot. The frontend is
deliberately absent until the later frontend issue — a component whose directory
does not exist is a check that never runs.

Components:
- kind: backend, path: backend, purpose: HTTP API, score ingest, and ranking logic

## Architecture

```text
Client
  ↓  POST score event
Rust API (Axum)
  ├─→ PostgreSQL   (durable events; migrations via sqlx)
  └─→ Redis        (sorted-set leaderboards; live rank reads)
```

## Directory Layout

```text
backend/    # Rust API: routes, services, storage, and ranking
```

## Key Commands

- **Install**: `cargo fetch` (run from `backend/`, once `Cargo.toml` exists)
- **Dev server**: `cargo run` (from `backend/`; reads `DATABASE_URL`, `REDIS_URL`)
- **Tests**: `cargo test`
- **Lint**: `cargo clippy --all-targets -- -D warnings`
- **Format**: `cargo fmt` / check with `cargo fmt --check`
- **Build**: `cargo build`
- **Migrations**: `sqlx migrate run` (once migrations exist)
- **All checks**: `make check` (delegates to `backend/Makefile`)

## Notes

- The project is scaffolded first: `AGENTS.md`, `opencode.json`, `.opencode/`,
  the Makefile, CI, Dependabot, `CODEOWNERS`, and issue/PR templates land before
  any Rust code. `make check` skips the Rust steps until `backend/Cargo.toml`
  exists — a skipped run is not a passed run.
- sqlx checks queries at compile time, which needs a live database or a committed
  `.sqlx/` offline cache used with `SQLX_OFFLINE=true`. **Never gitignore
  `.sqlx/`** — it is what makes a build reproducible without a running database.
- The frontend is deferred. When it lands, add a `frontend` component to the
  topology, a `frontend` agent, and `visual` QA — all four are shipped as
  templates but deliberately not configured yet.
- The dev environment runs in Docker Compose (`db`, `redis`, `dev`); credentials
  reach the container as environment variables, never baked into the image.
- Dev-sandbox host ports are overridable (`HOST_PORT`, and the DB/Redis host
  ports) so two sandboxes can run side by side without colliding.
