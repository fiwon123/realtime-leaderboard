# AGENTS.md

> **Source**: Product sections below are populated from `PROJECT_CONTEXT.md`.
> Keep the two in sync — `PROJECT_CONTEXT.md` is the brief, this file is the
> operating manual the agents read first.

### Product

## Project Objective

realtime-leaderboard — a Rust HTTP API that ingests score events and serves
ranked leaderboards with low latency, backed by PostgreSQL and Redis.

### Problem

Ranking a live stream of score events is awkward on a relational database alone:
an `ORDER BY score` over a growing table gets slower as the leaderboard heats up,
and a naive cache misses the event ordering that gives ties a stable position.

### Goal

A client can submit a score event, read a player's rank, and page through the top
of a leaderboard — with the durable event stored in PostgreSQL and the live
ranking served from Redis sorted sets.

### Main Technology

- Backend: Rust (Axum on Tokio)
- Database: PostgreSQL
- Query layer: sqlx (compile-time-checked SQL)
- Cache / ranking: Redis (sorted sets)
- Frontend: planned, not yet configured — see "Agents" below
- Development: Docker Compose (optional) + mise for toolchain pins

### Core Architecture

```text
Client
  ↓  POST score event
Rust API (Axum)
  ├─→ PostgreSQL   (durable events; migrations via sqlx)
  └─→ Redis        (sorted-set leaderboards; live rank reads)
```

## Project Structure

```text
backend/    # Rust API: routes, services, storage, and ranking
```

## Development Commands

### Backend

```bash
cd backend
cargo build                  # Compile
cargo run                    # Start the API (reads DATABASE_URL, REDIS_URL)
sqlx migrate run             # Apply migrations (once migrations exist)
cargo fmt                    # Format
cargo clippy --all-targets -- -D warnings   # Lint
cargo test                   # Unit + integration tests
```

### Docker Compose (optional)

```bash
docker compose up -d         # Start Postgres, Redis, and the dev sandbox
docker compose down          # Stop everything
docker compose logs -f dev   # Tail the dev container
```

### Run All Checks

```bash
make check
```

`make check` delegates to `backend/Makefile` (the Rust component fragment):
`cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`,
`cargo test --locked`, `cargo build --locked`.

**Until `backend/Cargo.toml` exists the Rust steps are skipped** — a skipped run
is not a passed run, so scaffolding changes are verified by review, not by
`make`. Prefer `make check` over listing commands separately: agents follow
whatever `check` runs, so a check missing from it is a check nobody performs.

## Runtime Environment

The AI agent (opencode) runs at the workspace root. The dev environment is Docker
Compose, but the agent runs *inside* the sandbox container where Docker is not
reachable.

### What the agent CAN do

- Edit Markdown, JSON, YAML, and Rust files
- Run git and GitHub CLI commands
- Run `cargo`, `rustfmt`, and `clippy` (once `backend/Cargo.toml` exists)
- Run `node`, `npm`, and `npx` (the Node LTS toolchain, for the frontend)
- Create and manage issues, PRs, and milestones
- Validate configuration files

### What the agent CANNOT do

- Run `docker` or `docker compose` commands (no Docker socket in the sandbox)
- Access the Docker socket
- Modify the host filesystem beyond the workspace

### Ports

The dev sandbox publishes `"${HOST_PORT:-8082}:8080"`, so the API is on host
**8082** by default — the sibling projects already hold 8080 and 8081. Postgres
and Redis are published on host **5433** and **6380** to avoid the default ports.
Every host port is env-overridable, so two sandboxes can run side by side.

| Service  | Host port | Container port |
|----------|-----------|----------------|
| dev (API)| 8082      | 8080           |
| Postgres | 5433      | 5432           |
| Redis    | 6380      | 6379           |

## Key Conventions

- **Assignee**: `fiwon123` — `workflow.md` tells agents to read `ASSIGNEE` from here before assigning issues and PRs
- **Two-tier branch model**: `main` (release only) ← `dev` (integration) ← feature branches
- **Issue-first workflow**: No code without an issue — open/organize, create branch, build, test, PR
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`
- **Configuration-only for now**: the scaffold ships first; application code starts with the first feature issue. `make check` skips the Rust steps until `backend/Cargo.toml` exists — a skipped run is not a passed run
- **Model assignments**: `opencode.json` is the source of truth — it assigns `opencode/big-pickle` to `build` and `opencode/mimo-v2.6-flash-free` to `plan`. Verify any new id with `opencode models` first: a catalog entry on models.dev does not guarantee your installed build offers it, and an unresolvable id fails at spawn rather than at config load
- **Formatting**: `rustfmt` (`cargo fmt --check` is the gate)
- **Linting**: `clippy` across all targets, warnings denied (`cargo clippy --all-targets -- -D warnings`)
- **Testing**: `cargo test` — unit tests inline in `backend/src/`, integration tests in `backend/tests/`
- **sqlx offline cache**: compile-time-checked queries need a live database at build time or a committed `.sqlx/` cache with `SQLX_OFFLINE=true`. **`.sqlx/` must not be gitignored** — dropping it turns every `cargo build` into a database requirement
- **CI**: GitHub Actions runs fmt + clippy + test + build on `dev` → `main` PRs only, plus manual `workflow_dispatch` — never on feature-branch pushes. Local `make check` is the feature-branch gate
- **Dev environment**: Docker Compose (`db`, `redis`, `dev`); credentials reach the container as environment variables, never baked into the image

## Environment and Secret-File Rules

- The backend environment file is `backend/.env` (the compose `dev` service may
  also read a root `.env` for interpolation).
- Never access it without explicit permission.
- Never open, read, print, summarize, quote, or send the contents of `.env`,
  `.env.*`, `.envrc`, or any other environment/secret file unless the user
  explicitly gives permission in the current conversation. `.env.example` is the
  one exception: it holds placeholders and is safe to read.
- Never access secret files (`.env`, etc.) without explicit permission.
- Never commit secrets, credentials, or environment values.

### Enforcement

Permission tables in `opencode.json` deny `read`/`edit` of `.env`, `.env.*`, and
`.envrc` (allowing `.env.example`), and deny `bash` commands that match those
paths or dump the environment (`printenv`, `env`, `docker compose config`,
`docker inspect`, `docker compose exec … env`). These rules match **whole command
strings and file paths, not intent**, and resolve **last match wins** with
agent-level rules taking precedence over the global table. Treat them as a
backstop, not as the permission:

- A repo-wide `grep -rn <SECRET_NAME> .` ignores `.gitignore` and can read a
  `.env` that is correctly excluded from version control. Prefer the Grep tool,
  which is gitignore-aware.
- There is no way to allow `.env.example` while denying `.env` in `bash`: a
  pattern matches the whole command, so `cat .env .env.example` would match an
  example allow and print the secret. That is why the example file is carved out
  of `read`/`edit` (one path per call) but not out of `bash`.

If the user explicitly permits reading environment configuration, read only
non-secret variables, never reveal values whose names contain `KEY`, `TOKEN`,
`SECRET`, `PASSWORD`, `PASS`, `CREDENTIAL`, `AUTH`, `PRIVATE`, `CERT`, `COOKIE`,
`WEBHOOK`, `DATABASE_URL`, or `CONNECTION_STRING`, and prefer checking that a
variable exists over printing it.

## Development Workflow

### Git Workflow

- Branch from `dev` (not `main`)
- Never push directly to `dev` or `main`
- Branch naming: `<type>/<issue-number>-<slug>` (e.g., `feat/4-score-ingest`)
- Branch types: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `ci/`
- Do NOT merge pull requests unless explicitly instructed
- Do NOT automatically create release PRs or merge to main — user must explicitly request
- Always return to `dev` branch after completing any merge
- Every change is tracked on GitHub: **issue → branch → PR → merge**

### Linking

- Every branch includes the issue number: `feat/4-score-ingest`
- Every PR references its issue: `Closes #<number>`
- Every issue is assigned to a milestone before work begins
- Every PR is assigned to a milestone when created
- No orphaned branches, PRs, or issues

### Branch Strategy

```text
main          ← release merges (CI runs here — dev→main PRs only)
  └── dev     ← integration branch (all feature branches merge here)
        ├── feat/4-score-ingest
        ├── fix/9-rank-tiebreak
        └── refactor/12-claim-transaction
```

- Feature branches: `feat/<issue>-<slug>` → merge to `dev`
- Release: `dev` → `main` (PR triggers CI — user must explicitly request)
- Hotfixes: `fix/<issue>-<slug>` → merge to `dev`, cherry-pick to `main` if urgent

### Milestones

- Every issue MUST be assigned to a milestone before work begins
- Milestones represent releases or sprint iterations
- The active milestone is `v0.1-MVP`
- Use `gh issue edit <issue-number> --milestone "<milestone-name>"`

### Agents

Agent definitions live in `opencode.json` and `.opencode/agents/`:

- **build** (primary): Full development work with all tools enabled.
- **plan** (primary): Analysis and planning without making changes.
- **reviewer** (subagent): Reviews code for bugs, security, and regressions.
- **backend** (subagent): Implements `backend/` routes, services, and ranking logic; `edit` is scoped to `backend/**`.
- **tester** (subagent): Writes and runs tests; `edit` is scoped to test files and fixtures.

`frontend` and `visual` ship in the templates but are **not configured here** —
the frontend is deferred to its own issue. Add them, and their `task` permission
entries, when the frontend lands; a subagent whose `edit` scope points at a
directory that does not exist is an expensive way to say nothing.

Each agent's instructions live in exactly one place: the body of
`.opencode/agents/<name>.md`. Model, mode, and permissions live in `opencode.json`.
Do not duplicate the prompt into `opencode.json` — two prompt sources for one
agent drift apart, and nothing states which one wins. An agent named in
`opencode.json` without a matching markdown file has no instructions at all; add
its `.md` in the same commit.

### Skills

- Load relevant skills when working on specific domains (e.g., GitHub workflow, API design, Docker)
- `.opencode/skills/github-workflow/SKILL.md` is the command cookbook for git, issues, and PRs. `workflow.md` remains the policy authority; the skill is the quick reference.

### Session Memory (3-tier)

- At the START of every new chat: read `.opencode/memory/global.md` then
  `.opencode/memory/current.md` and resume from "Next action" — this is how
  long-running work survives between sessions. If the state references an
  issue/branch/PR, continue that work unless the user says otherwise.
- At meaningful milestones (issue created, branch renamed, code done, tests
  run, PR opened, merged) update `global.md`; update `current.md` after each
  step and at session end rotate the oldest archive out so only 3 remain.
- Keep sizes bounded: `global.md` ≤ ~200 lines, `current.md` ≤ ~100 lines,
  archive files ≤ ~50 lines each; never store secrets.
- The whole `.opencode/memory/` directory is gitignored — it is local state and
  is never committed or pushed.

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs `cargo fmt --check`,
`cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked`, and
`cargo build --locked` on `dev` → `main` PRs, and on manual `workflow_dispatch`.
It never runs on feature-branch pushes, so `make check` locally is the gate for
feature work.

Two things make a run verify nothing: a `paths:` filter the change does not touch
means the workflow does not trigger at all, and a job gated behind a label or
`if:` condition reports `skipped`, not `passed`.

**Skipped is not passed.** A triggered run whose jobs were all gated out, or a run
that never happened, is not coverage. Do not describe a change as "CI passed"
unless a run actually executed the job that covers it; if it did not, say the
change is unverified and test it locally.
