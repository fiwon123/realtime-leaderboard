//! Queries over `score_events` (durable log) and `player_scores` (materialized
//! best-per-player standing). Ranking itself is served from Redis; Postgres is
//! the durable source of truth these rows are rebuilt from.
//!
//! Per-row functions take an executor so callers can compose them inside a
//! transaction; the whole-table scan takes the pool directly.

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

/// Escape the `LIKE`/`ILIKE` metacharacters in a user-supplied prefix so a
/// literal `%` or `_` cannot widen the search.
fn escape_like(input: &str) -> String {
    let mut escaped = String::with_capacity(input.len());
    for ch in input.chars() {
        if matches!(ch, '\\' | '%' | '_') {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped
}

/// Case-insensitive prefix search over materialized standings, highest score
/// first, capped at `limit`. Used to offer player suggestions while typing.
///
/// Uses the runtime query API rather than the `query_scalar!` macro: the search
/// term is built at runtime (escaped) and the compile-time macro would add a
/// cache entry for a query that is inherently dynamic. The SQL is fixed.
pub async fn search_players(pool: &PgPool, prefix: &str, limit: i64) -> sqlx::Result<Vec<String>> {
    let pattern = format!("{}%", escape_like(prefix));
    sqlx::query_scalar::<_, String>(
        r#"
        SELECT player_id
        FROM player_scores
        WHERE player_id ILIKE $1 ESCAPE '\'
        ORDER BY best_score DESC, best_seq ASC, player_id
        LIMIT $2
        "#,
    )
    .bind(pattern)
    .bind(limit)
    .fetch_all(pool)
    .await
}

/// Delete a player's durable events and materialized standing in one
/// transaction. Returns the number of `player_scores` rows removed (`0` when
/// the player was unknown), so a caller can tell "removed" from "was not there".
///
/// Uses the runtime query API: these statements need no compile-time type
/// inference and so add no `.sqlx` cache entry.
pub async fn delete_player(pool: &PgPool, player_id: &str) -> sqlx::Result<u64> {
    let mut tx = pool.begin().await?;

    sqlx::query("DELETE FROM score_events WHERE player_id = $1")
        .bind(player_id)
        .execute(&mut *tx)
        .await?;

    let removed = sqlx::query("DELETE FROM player_scores WHERE player_id = $1")
        .bind(player_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(removed.rows_affected())
}

/// Remove every durable event and standing. `RESTART IDENTITY` resets the
/// `seq` sequence so a rebuild orders from scratch.
///
/// Takes an executor (not the pool) so a test can run it inside a transaction
/// it rolls back, exercising the statement without destroying the live rows.
pub async fn clear_all<'e, E>(executor: E) -> sqlx::Result<()>
where
    E: PgExecutor<'e>,
{
    sqlx::query("TRUNCATE score_events, player_scores RESTART IDENTITY")
        .execute(executor)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::escape_like;

    #[test]
    fn escape_like_neutralises_metacharacters() {
        assert_eq!(escape_like("alice"), "alice");
        assert_eq!(escape_like("a%"), "a\\%");
        assert_eq!(escape_like("a_b"), "a\\_b");
        assert_eq!(escape_like("a\\b"), "a\\\\b");
    }
}
