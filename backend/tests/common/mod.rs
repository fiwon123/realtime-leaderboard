//! Shared helpers for integration tests.
//!
//! Integration tests need Postgres and Redis. `try_state` returns `None` when
//! the services are unreachable so a bare `cargo test` stays green on a machine
//! with nothing running (see `.opencode/instructions/testing.md`).

use realtime_leaderboard::AppState;

/// Build an [`AppState`] from `DATABASE_URL` / `REDIS_URL`, or `None` if the
/// variables are unset or the services cannot be reached.
pub async fn try_state() -> Option<AppState> {
    let database_url = std::env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.is_empty())?;
    let redis_url = std::env::var("REDIS_URL")
        .ok()
        .filter(|value| !value.is_empty())?;

    let db = sqlx::PgPool::connect(&database_url).await.ok()?;
    let client = redis::Client::open(redis_url).ok()?;
    let redis = redis::aio::ConnectionManager::new(client).await.ok()?;

    Some(AppState { db, redis })
}

/// Like [`try_state`], but applies migrations first. Returns `None` when the
/// services are unreachable so tests skip cleanly.
pub async fn try_migrated_state() -> Option<AppState> {
    let state = try_state().await?;
    sqlx::migrate!("./migrations").run(&state.db).await.ok()?;
    Some(state)
}
