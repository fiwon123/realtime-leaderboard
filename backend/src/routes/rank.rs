//! `GET /players/{player_id}/rank` — a player's live board position.

use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;
use tokio::time::timeout;
use utoipa::ToSchema;

use crate::error::ApiError;
use crate::services::ranking;
use crate::state::AppState;

use super::{validate_player_id, READ_TIMEOUT};

#[derive(Debug, Serialize, PartialEq, Eq, ToSchema)]
pub struct RankResponse {
    #[schema(example = "alice")]
    pub player_id: String,
    /// 1-based position, 1 = the current leader.
    pub rank: u64,
    /// Best score, as the integer part of the composite.
    pub score: i64,
}

/// `GET /players/{player_id}/rank` — a player's live board position.
#[utoipa::path(
    get,
    path = "/players/{player_id}/rank",
    params(("player_id" = String, Path, description = "Player id, 1..=128 bytes")),
    responses(
        (status = OK, description = "The player's live standing", body = RankResponse),
        (status = BAD_REQUEST, description = "Blank or overlong player_id"),
        (status = NOT_FOUND, description = "Player has no standing yet"),
        (status = SERVICE_UNAVAILABLE, description = "Leaderboard store unreachable"),
    ),
    tag = "leaderboard",
)]
pub async fn get_rank(
    State(state): State<AppState>,
    Path(player_id): Path<String>,
) -> Result<Json<RankResponse>, ApiError> {
    validate_player_id(&player_id)?;

    let mut conn = state.redis.clone();
    let result = timeout(READ_TIMEOUT, ranking::rank_of(&mut conn, &player_id))
        .await
        .map_err(|_elapsed| ApiError::Unavailable)??;

    match result {
        Some((rank, score)) => Ok(Json(RankResponse {
            player_id,
            rank,
            score,
        })),
        None => Err(ApiError::NotFound),
    }
}
