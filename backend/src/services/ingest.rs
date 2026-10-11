//! Score ingest: durable write plus ranking projection.
//!
//! Postgres is the source of truth. A single transaction appends the event and
//! materializes the player's best standing; only then is the Redis sorted set
//! updated. A Redis failure is logged, not surfaced: the event is already
//! durable, and ranking is reconciled by a later event or the rebuild binary.

use uuid::Uuid;

use crate::error::ApiError;
use crate::services::ranking;
use crate::state::AppState;
use crate::storage::scores;

/// Result of an ingest attempt.
pub struct IngestOutcome {
    /// `true` when the `event_id` had already been ingested.
    pub duplicate: bool,
}

/// Record a score event and project the player's standing into Redis.
pub async fn ingest_score(
    state: &AppState,
    event_id: Uuid,
    player_id: &str,
    score: i64,
) -> Result<IngestOutcome, ApiError> {
    let mut tx = state.db.begin().await?;

    let inserted = scores::insert_event(&mut *tx, event_id, player_id, score).await?;
    if let Some(seq) = inserted {
        scores::upsert_player_best(&mut *tx, player_id, score, seq).await?;
    }

    // The authoritative standing, whether this request inserted the event or
    // replayed it. Projecting it (rather than assuming this event won) means a
    // replay after a failed Redis write still converges.
    let standing = scores::player_best(&mut *tx, player_id).await?;

    tx.commit().await?;

    if let Some(best) = standing {
        let mut conn = state.redis.clone();
        if let Err(err) =
            ranking::apply_standing(&mut conn, player_id, best.best_score, best.best_seq).await
        {
            tracing::error!(
                %err, %player_id,
                "failed to update Redis ranking; a later event or rebuild will reconcile"
            );
        }
    }

    Ok(IngestOutcome {
        duplicate: inserted.is_none(),
    })
}
