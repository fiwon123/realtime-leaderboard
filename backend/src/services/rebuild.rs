//! Rebuild the Redis leaderboard from Postgres.
//!
//! Redis is a projection of the durable `player_scores` standings. If it drifts
//! (a failed projection, manual edits, eviction), this recreates it from the
//! source of truth: the key is replaced wholesale in one pipeline.

use crate::error::ApiError;
use crate::services::ranking;
use crate::state::AppState;
use crate::storage::scores;

/// Re-create the leaderboard key from Postgres, returning the number of
/// standings written. Replaces the key, so stale members (players with no
/// Postgres standing) are removed.
///
/// A concurrent ingest may race the swap; its post-commit `ZADD ... GT`
/// projection is monotonic, so at worst the rebuild is reconciled upward by
/// the next event for that player.
pub async fn rebuild(state: &AppState) -> Result<usize, ApiError> {
    let standings = scores::all_player_bests(&state.db).await?;

    let mut conn = state.redis.clone();
    let mut pipe = redis::pipe();
    pipe.cmd("DEL").arg(ranking::LEADERBOARD_KEY);
    for standing in &standings {
        pipe.cmd("ZADD")
            .arg(ranking::LEADERBOARD_KEY)
            .arg(ranking::composite_score(
                standing.best_score,
                standing.best_seq,
            ))
            .arg(&standing.player_id);
    }
    pipe.query_async::<Vec<i64>>(&mut conn).await?;

    Ok(standings.len())
}
