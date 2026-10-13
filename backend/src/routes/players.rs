//! `GET /players` — case-insensitive substring search over known players, used
//! to offer suggestions while typing a player id. Closest matches rank first.

use axum::extract::rejection::QueryRejection;
use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::{ApiError, ErrorBody};
use crate::state::AppState;
use crate::storage;

use super::MAX_PLAYER_ID_LEN;

const DEFAULT_LIMIT: u64 = 5;
const MAX_LIMIT: u64 = 25;

#[derive(Debug, Deserialize)]
pub struct PlayersParams {
    pub prefix: Option<String>,
    pub limit: Option<u64>,
}

#[derive(Debug, Serialize, PartialEq, Eq, ToSchema)]
pub struct PlayersResponse {
    /// Matching player ids, closest match first.
    pub players: Vec<String>,
}

/// `GET /players?prefix=&limit=` — substring-search known players.
#[utoipa::path(
    get,
    path = "/players",
    params(
        ("prefix" = String, Query, min_length = 1, max_length = 128, description = "Case-insensitive player-id substring (matched anywhere), 1..=128 bytes; exact and prefix matches rank first"),
        ("limit" = Option<u64>, Query, minimum = 1, maximum = 25, description = "Max suggestions; defaults to 5, must be 1..=25"),
    ),
    responses(
        (status = OK, description = "Matching player ids, closest match first", body = PlayersResponse),
        (status = BAD_REQUEST, description = "Blank/overlong prefix, or limit outside 1..=25", body = ErrorBody),
        (status = INTERNAL_SERVER_ERROR, description = "Database failed", body = ErrorBody),
    ),
    tag = "leaderboard",
)]
pub async fn search_players(
    State(state): State<AppState>,
    params: Result<Query<PlayersParams>, QueryRejection>,
) -> Result<Json<PlayersResponse>, ApiError> {
    let Query(params) = params.map_err(|rejection| ApiError::BadRequest(rejection.body_text()))?;

    let prefix = params.prefix.unwrap_or_default();
    let trimmed = prefix.trim();
    if trimmed.is_empty() {
        return Err(ApiError::BadRequest("prefix must not be empty".into()));
    }
    if trimmed.len() > MAX_PLAYER_ID_LEN {
        return Err(ApiError::BadRequest(format!(
            "prefix must be at most {MAX_PLAYER_ID_LEN} bytes"
        )));
    }

    let limit = params.limit.unwrap_or(DEFAULT_LIMIT);
    if !(1..=MAX_LIMIT).contains(&limit) {
        return Err(ApiError::BadRequest(format!(
            "limit must be between 1 and {MAX_LIMIT}"
        )));
    }

    let players = storage::scores::search_players(&state.db, trimmed, limit as i64).await?;

    Ok(Json(PlayersResponse { players }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn response_serializes_players() {
        let body = serde_json::to_value(PlayersResponse {
            players: vec!["alice".into(), "al".into()],
        })
        .expect("serialize");

        assert_eq!(body, serde_json::json!({ "players": ["alice", "al"] }));
    }
}
