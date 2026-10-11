//! HTTP route handlers.

pub mod health;
pub mod leaderboard;
pub mod rank;
pub mod scores;

use crate::error::ApiError;

/// Longest allowed player id; shared by validation and bounds.
pub const MAX_PLAYER_ID_LEN: usize = 128;

/// Reject blank or overlong player ids before they reach storage or logs.
pub fn validate_player_id(player_id: &str) -> Result<(), ApiError> {
    if player_id.trim().is_empty() {
        return Err(ApiError::BadRequest("player_id must not be empty".into()));
    }
    if player_id.len() > MAX_PLAYER_ID_LEN {
        return Err(ApiError::BadRequest(format!(
            "player_id must be at most {MAX_PLAYER_ID_LEN} bytes"
        )));
    }
    Ok(())
}
