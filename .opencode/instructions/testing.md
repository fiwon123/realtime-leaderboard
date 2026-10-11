## Testing Requirements

### General

- Tests are mandatory for new features and bug fixes
- Write tests before or alongside implementation
- Mock external services when possible — never call a real third-party production API in tests
- Aim for critical-path coverage, not 100% line coverage

### Prerequisites / Services

- Integration tests that touch PostgreSQL or Redis need the compose services:
  `docker compose up -d db redis` (or `make dev-up` for the whole stack).
- Unit tests must run without any service. Keep the default `cargo test` free of
  external dependencies; put anything that needs a database behind an explicit
  gate (a separate `tests/` file, a `#[ignore]`, or an env check) so a bare
  `cargo test` stays green on a laptop with nothing running.

### Backend

- **Framework**: the built-in test harness (`cargo test`), plus `tokio::test`
  for async code and `sqlx::test` for database-backed tests
- **Location**: inline unit tests in `backend/src/`, integration tests in `backend/tests/`
- **Run**: `cargo test` (add `--locked` in CI-shaped runs)

#### Test Structure

```text
backend/
├── src/
│   └── <module>.rs        # #[cfg(test)] mod tests { ... } for unit tests
└── tests/
    └── <flow>.rs          # integration tests: build the app, exercise a flow
```

#### Conventions

- Unit tests live in a `#[cfg(test)] mod tests` block next to the code they cover
- Integration tests live in `backend/tests/` and use the crate as a library
- Mark async tests `#[tokio::test]`; mark DB-backed tests so they can be skipped
  when no database is available
- Test function names describe the behaviour: `rejects_duplicate_event_id`
- Use fixtures/helpers over copy-paste; keep a shared `tests/common/` module
- Mock external services — never call a real third-party or production API

### Linting

```bash
cd backend
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
```

### Before Committing

1. Format: `cargo fmt`
2. Lint: `cargo clippy --all-targets --locked -- -D warnings`
3. Test: `cargo test --locked`
4. Or run everything at once: `make check`
5. Verify no regressions

## Visual checks

This project has no user interface yet — there is nothing to screenshot, and no
`visual` subagent is configured. Visual checks **do not apply** to the current
scope.

When the frontend lands, add a `visual` subagent (it ships in the templates) and
follow the capture/look/act rule: **the main agent captures, the `visual` subagent
looks, the main agent acts on the findings.** Never report a visual conclusion
the `visual` subagent has not actually returned; if a review fails or is
rate-limited, say the state is unverified and retry in a smaller batch.
