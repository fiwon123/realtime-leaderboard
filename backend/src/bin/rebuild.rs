//! Rebuild the Redis leaderboard from Postgres.
//!
//! An operator tool: `cargo run --bin rebuild`. Reads `DATABASE_URL` and
//! `REDIS_URL` (same env the API uses) and re-creates the `leaderboard:default`
//! sorted set from the durable `player_scores` standings.

use std::process::ExitCode;

use redis::aio::ConnectionManager;
use sqlx::PgPool;

use realtime_leaderboard::config::Config;
use realtime_leaderboard::services::rebuild::rebuild;
use realtime_leaderboard::state::AppState;

#[tokio::main]
async fn main() -> ExitCode {
    let config = match Config::from_env() {
        Ok(config) => config,
        Err(err) => {
            eprintln!("configuration error: {err}");
            return ExitCode::FAILURE;
        }
    };

    let db = match PgPool::connect(&config.database_url).await {
        Ok(db) => db,
        Err(err) => {
            eprintln!("cannot connect to Postgres: {err}");
            return ExitCode::FAILURE;
        }
    };
    let client = match redis::Client::open(config.redis_url.as_str()) {
        Ok(client) => client,
        Err(err) => {
            eprintln!("cannot parse Redis URL: {err}");
            return ExitCode::FAILURE;
        }
    };
    let redis = match ConnectionManager::new(client).await {
        Ok(redis) => redis,
        Err(err) => {
            eprintln!("cannot connect to Redis: {err}");
            return ExitCode::FAILURE;
        }
    };

    let state = AppState { db, redis };
    match rebuild(&state).await {
        Ok(count) => {
            println!("rebuilt leaderboard: {count} standings");
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("rebuild failed: {err}");
            ExitCode::FAILURE
        }
    }
}
