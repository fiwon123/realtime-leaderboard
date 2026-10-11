//! `POST /scores` — submit a score event.

use axum::extract::rejection::JsonRejection;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::ApiError;
use crate::services::ingest::ingest_score;
use crate::state::AppState;

/// Largest score the ranking encoding can order faithfully; mirrored by the
/// `score_events` / `player_scores` CHECK constraints.
const MAX_SCORE: i64 = 1_000_000_000;
const MAX_PLAYER_ID_LEN: usize = 128;

#[derive(Debug, Deserialize)]
pub struct ScoreEvent {
    pub event_id: Uuid,
    pub player_id: String,
    pub score: i64,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct ScoreEventResponse {
    pub event_id: Uuid,
    pub player_id: String,
    pub score: i64,
    /// `true` when this `event_id` had already been ingested.
    pub duplicate: bool,
}

/// `POST /scores` — 201 on a new event, 200 on an idempotent replay.
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
    if event.player_id.trim().is_empty() {
        return Err(ApiError::BadRequest("player_id must not be empty".into()));
    }
    if event.player_id.len() > MAX_PLAYER_ID_LEN {
        return Err(ApiError::BadRequest(format!(
            "player_id must be at most {MAX_PLAYER_ID_LEN} bytes"
        )));
    }
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
