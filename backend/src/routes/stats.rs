//! `GET /stats` — at-a-glance board size and peak score.

use axum::extract::State;
use axum::Json;
use serde::Serialize;
use tokio::time::timeout;
use utoipa::ToSchema;

use crate::error::{ApiError, ErrorBody};
use crate::services::ranking;
use crate::state::AppState;

use super::READ_TIMEOUT;

#[derive(Debug, Serialize, PartialEq, Eq, ToSchema)]
pub struct StatsResponse {
    /// Number of players with a standing on the board.
    pub players: u64,
    /// Highest score on the board, or `null` when it is empty.
    pub top_score: Option<i64>,
}

/// `GET /stats` — board size and peak score.
#[utoipa::path(
    get,
    path = "/stats",
    responses(
        (status = OK, description = "Board size and peak score", body = StatsResponse),
        (status = SERVICE_UNAVAILABLE, description = "Leaderboard store did not answer in time", body = ErrorBody),
        (status = INTERNAL_SERVER_ERROR, description = "Leaderboard store failed", body = ErrorBody),
    ),
    tag = "leaderboard",
)]
pub async fn get_stats(State(state): State<AppState>) -> Result<Json<StatsResponse>, ApiError> {
    let mut conn = state.redis.clone();

    // One read budget covers both lookups, so a hung Redis cannot double the wait.
    let (players, top_score) = timeout(READ_TIMEOUT, async {
        let players = ranking::count(&mut conn).await?;
        let top_score = ranking::peak(&mut conn).await?;
        Ok::<_, redis::RedisError>((players, top_score))
    })
    .await
    .map_err(|_elapsed| ApiError::Unavailable)??;

    Ok(Json(StatsResponse { players, top_score }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn top_score_serializes_as_null_when_the_board_is_empty() {
        let body = serde_json::to_value(StatsResponse {
            players: 0,
            top_score: None,
        })
        .expect("serialize");

        assert_eq!(body, serde_json::json!({ "players": 0, "top_score": null }));
    }
}
