//! `GET /leaderboard` — page through the top of the board, highest first.

use axum::extract::rejection::QueryRejection;
use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use tokio::time::timeout;

use crate::error::ApiError;
use crate::services::ranking;
use crate::state::AppState;

use super::READ_TIMEOUT;

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
    params: Result<Query<LeaderboardParams>, QueryRejection>,
) -> Result<Json<LeaderboardResponse>, ApiError> {
    let Query(params) = params.map_err(|rejection| ApiError::BadRequest(rejection.body_text()))?;

    let limit = params.limit.unwrap_or(DEFAULT_LIMIT);
    if !(1..=MAX_LIMIT).contains(&limit) {
        return Err(ApiError::BadRequest(format!(
            "limit must be between 1 and {MAX_LIMIT}"
        )));
    }
    let offset = params.offset.unwrap_or(0);

    // Bounded arithmetic: a client-supplied `offset` must not overflow the i64
    // window Redis takes. Validate before casting — a wrap would otherwise
    // panic in debug builds and silently misbehave in release.
    let Some(stop) = offset.checked_add(limit - 1) else {
        return Err(ApiError::BadRequest("offset too large".into()));
    };
    if stop > i64::MAX as u64 {
        return Err(ApiError::BadRequest("offset too large".into()));
    }
    let start = offset as i64;
    let stop = stop as i64;

    let mut conn = state.redis.clone();
    let rows = timeout(READ_TIMEOUT, ranking::top(&mut conn, start, stop))
        .await
        .map_err(|_elapsed| ApiError::Unavailable)??;

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
