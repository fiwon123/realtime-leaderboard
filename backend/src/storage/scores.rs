//! Queries over `score_events` (durable log) and `player_scores` (materialized
//! best-per-player standing). Ranking itself is served from Redis; Postgres is
//! the durable source of truth these rows are rebuilt from.
//!
//! Every function takes an executor so callers can compose them inside a
//! transaction.

use sqlx::{PgExecutor, PgPool};

/// A player's best standing, as materialized in Postgres.
#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct PlayerBest {
    pub player_id: String,
    pub best_score: i64,
    pub best_seq: i64,
}

/// Insert a score event, returning its `seq` when newly inserted or `None` when
/// the `event_id` was already present (a replay under at-least-once delivery).
pub async fn insert_event<'e, E>(
    executor: E,
    event_id: uuid::Uuid,
    player_id: &str,
    score: i64,
) -> sqlx::Result<Option<i64>>
where
    E: PgExecutor<'e>,
{
    let row = sqlx::query!(
        r#"
        INSERT INTO score_events (event_id, player_id, score)
        VALUES ($1, $2, $3)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING seq
        "#,
        event_id,
        player_id,
        score,
    )
    .fetch_optional(executor)
    .await?;

    Ok(row.map(|row| row.seq))
}

/// Materialize a new best for a player when `(score, seq)` strictly improves on
/// the stored standing (higher score, or equal score with an earlier `seq`).
///
/// Returns `true` when a row was inserted or updated, `false` when the existing
/// standing already dominates.
pub async fn upsert_player_best<'e, E>(
    executor: E,
    player_id: &str,
    score: i64,
    seq: i64,
) -> sqlx::Result<bool>
where
    E: PgExecutor<'e>,
{
    let result = sqlx::query!(
        r#"
        INSERT INTO player_scores (player_id, best_score, best_seq)
        VALUES ($1, $2, $3)
        ON CONFLICT (player_id) DO UPDATE
            SET best_score = EXCLUDED.best_score,
                best_seq   = EXCLUDED.best_seq,
                updated_at = now()
            WHERE EXCLUDED.best_score > player_scores.best_score
               OR (EXCLUDED.best_score = player_scores.best_score
                   AND EXCLUDED.best_seq < player_scores.best_seq)
        "#,
        player_id,
        score,
        seq,
    )
    .execute(executor)
    .await?;

    Ok(result.rows_affected() == 1)
}

/// Fetch a single player's materialized standing, if any.
pub async fn player_best<'e, E>(executor: E, player_id: &str) -> sqlx::Result<Option<PlayerBest>>
where
    E: PgExecutor<'e>,
{
    sqlx::query_as!(
        PlayerBest,
        r#"
        SELECT player_id, best_score, best_seq
        FROM player_scores
        WHERE player_id = $1
        "#,
        player_id,
    )
    .fetch_optional(executor)
    .await
}

/// Fetch every materialized standing, used to rebuild the Redis sorted set.
pub async fn all_player_bests(pool: &PgPool) -> sqlx::Result<Vec<PlayerBest>> {
    sqlx::query_as!(
        PlayerBest,
        r#"
        SELECT player_id, best_score, best_seq
        FROM player_scores
        ORDER BY player_id
        "#,
    )
    .fetch_all(pool)
    .await
}
