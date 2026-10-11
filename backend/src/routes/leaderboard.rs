//! `GET /leaderboard` — page through the top of the board, highest first.

use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::error::ApiError;
use crate::services::ranking;
use crate::state::AppState;

const DEFAULT_LIMIT: u64 = 10;
const MAX_LIMIT: u64 = 100;

#[derive(Debug, Deserialize)]
pub struct LeaderboardParams {
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct LeaderboardEntry {
    /// 1-based position, 1 = the current leader.
    pub rank: u64,
    pub player_id: String,
    /// Best score, as the integer part of the composite.
    pub score: i64,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct LeaderboardResponse {
    pub entries: Vec<LeaderboardEntry>,
}

pub async fn get_leaderboard(
    State(state): State<AppState>,
    Query(params): Query<LeaderboardParams>,
) -> Result<Json<LeaderboardResponse>, ApiError> {
    let limit = params.limit.unwrap_or(DEFAULT_LIMIT);
    if !(1..=MAX_LIMIT).contains(&limit) {
        return Err(ApiError::BadRequest(format!(
            "limit must be between 1 and {MAX_LIMIT}"
        )));
    }
    let offset = params.offset.unwrap_or(0);

    let mut conn = state.redis.clone();
    let start = offset as i64;
    let stop = offset as i64 + limit as i64 - 1;
    let rows = ranking::top(&mut conn, start, stop).await?;

    let entries = rows
        .into_iter()
        .enumerate()
        .map(|(index, (player_id, composite))| LeaderboardEntry {
            rank: start as u64 + index as u64 + 1,
            player_id,
            score: ranking::decode_score(composite),
        })
        .collect();

    Ok(Json(LeaderboardResponse { entries }))
}
