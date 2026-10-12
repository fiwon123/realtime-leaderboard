//! `POST /scores` — submit a score event.

use axum::extract::rejection::JsonRejection;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::error::{ApiError, ErrorBody};
use crate::services::ingest::ingest_score;
use crate::state::AppState;

use super::validate_player_id;

/// Largest score the ranking encoding can order faithfully; must match the
/// `score_events` / `player_scores` CHECK constraints in `0001_init.sql`.
const MAX_SCORE: i64 = 1_000_000_000;

#[derive(Debug, Deserialize, ToSchema)]
pub struct ScoreEvent {
    #[schema(example = "10a60a3a-c86c-4427-ae39-2db5a38e0dbd")]
    pub event_id: Uuid,
    #[schema(example = "alice", min_length = 1, max_length = 128)]
    pub player_id: String,
    #[schema(example = 100, minimum = 0, maximum = 1000000000)]
    pub score: i64,
}

#[derive(Debug, Serialize, PartialEq, Eq, ToSchema)]
pub struct ScoreEventResponse {
    #[schema(example = "10a60a3a-c86c-4427-ae39-2db5a38e0dbd")]
    pub event_id: Uuid,
    #[schema(example = "alice")]
    pub player_id: String,
    #[schema(example = 100)]
    pub score: i64,
    /// `true` when this `event_id` had already been ingested.
    pub duplicate: bool,
}

/// `POST /scores` — 201 on a new event, 200 on an idempotent replay.
#[utoipa::path(
    post,
    path = "/scores",
    request_body = ScoreEvent,
    responses(
        (status = CREATED, description = "Event stored durably; the live ranking is updated best-effort", body = ScoreEventResponse),
        (status = OK, description = "Duplicate event_id — already ingested", body = ScoreEventResponse),
        (status = BAD_REQUEST, description = "Invalid payload, blank/overlong player_id, or score outside 0..=1_000_000_000", body = ErrorBody),
        (status = INTERNAL_SERVER_ERROR, description = "Could not store the event", body = ErrorBody),
    ),
    tag = "scores",
)]
pub async fn submit_score(
    State(state): State<AppState>,
    payload: Result<Json<ScoreEvent>, JsonRejection>,
) -> Result<(StatusCode, Json<ScoreEventResponse>), ApiError> {
    let Json(event) = payload.map_err(|rejection| ApiError::BadRequest(rejection.body_text()))?;
    validate(&event)?;

    let outcome = ingest_score(&state, event.event_id, &event.player_id, event.score).await?;
    let status = if outcome.duplicate {
        StatusCode::OK
    } else {
        StatusCode::CREATED
    };

    Ok((
        status,
        Json(ScoreEventResponse {
            event_id: event.event_id,
            player_id: event.player_id,
            score: event.score,
            duplicate: outcome.duplicate,
        }),
    ))
}

fn validate(event: &ScoreEvent) -> Result<(), ApiError> {
    validate_player_id(&event.player_id)?;
    if !(0..=MAX_SCORE).contains(&event.score) {
        return Err(ApiError::BadRequest(format!(
            "score must be between 0 and {MAX_SCORE}"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::routes::MAX_PLAYER_ID_LEN;

    fn event(player_id: &str, score: i64) -> ScoreEvent {
        ScoreEvent {
            event_id: Uuid::new_v4(),
            player_id: player_id.to_string(),
            score,
        }
    }

    #[test]
    fn accepts_a_well_formed_event() {
        assert!(validate(&event("player-1", 0)).is_ok());
        assert!(validate(&event("player-1", MAX_SCORE)).is_ok());
    }

    #[test]
    fn rejects_blank_player_id() {
        assert!(validate(&event("   ", 1)).is_err());
    }

    #[test]
    fn rejects_out_of_range_scores() {
        assert!(validate(&event("player-1", -1)).is_err());
        assert!(validate(&event("player-1", MAX_SCORE + 1)).is_err());
    }

    #[test]
    fn rejects_overlong_player_id() {
        assert!(validate(&event(&"x".repeat(MAX_PLAYER_ID_LEN + 1), 1)).is_err());
    }
}
