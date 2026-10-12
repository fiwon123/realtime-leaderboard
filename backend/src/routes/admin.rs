//! Admin routes: `DELETE /players/{player_id}` and `DELETE /scores`.
//!
//! Both are gated by the optional `ADMIN_TOKEN`. When the token is unset the
//! routes answer `503` — a deployment that forgot to configure the token
//! exposes no unguarded destructive surface. Requests authenticate with
//! `Authorization: Bearer <token>`, compared in constant time.
//!
//! The durable delete happens in Postgres first, then the Redis projection is
//! updated. If the projection fails the request fails loudly (`500`) rather
//! than reporting success over a stale board; the board is repaired by a
//! rebuild (`cargo run --bin rebuild`).

use axum::extract::{Path, State};
use axum::http::header::AUTHORIZATION;
use axum::http::{HeaderMap, StatusCode};

use crate::error::{ApiError, ErrorBody};
use crate::services::ranking;
use crate::state::AppState;
use crate::storage;

use super::{validate_player_id, READ_TIMEOUT};

/// `DELETE /players/{player_id}` — remove one player from both stores.
#[utoipa::path(
    delete,
    path = "/players/{player_id}",
    params(
        ("player_id" = String, Path, min_length = 1, max_length = 128, description = "Player id to remove"),
    ),
    responses(
        (status = NO_CONTENT, description = "Player removed (idempotent — unknown ids still return 204)"),
        (status = UNAUTHORIZED, description = "Missing or incorrect bearer token", body = ErrorBody),
        (status = BAD_REQUEST, description = "Blank or overlong player_id", body = ErrorBody),
        (status = SERVICE_UNAVAILABLE, description = "ADMIN_TOKEN is not configured; admin routes are disabled", body = ErrorBody),
        (status = INTERNAL_SERVER_ERROR, description = "Delete failed", body = ErrorBody),
    ),
    tag = "admin",
)]
pub async fn delete_player(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(player_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    authorize(&state, &headers)?;
    validate_player_id(&player_id)?;

    storage::scores::delete_player(&state.db, &player_id).await?;
    remove_from_board(&state, &player_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// `DELETE /scores` — clear every event and standing from both stores.
#[utoipa::path(
    delete,
    path = "/scores",
    responses(
        (status = NO_CONTENT, description = "All events and standings removed"),
        (status = UNAUTHORIZED, description = "Missing or incorrect bearer token", body = ErrorBody),
        (status = SERVICE_UNAVAILABLE, description = "ADMIN_TOKEN is not configured; admin routes are disabled", body = ErrorBody),
        (status = INTERNAL_SERVER_ERROR, description = "Clear failed", body = ErrorBody),
    ),
    tag = "admin",
)]
pub async fn clear_scores(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<StatusCode, ApiError> {
    authorize(&state, &headers)?;

    storage::scores::clear_all(&state.db).await?;

    let mut conn = state.redis.clone();
    tokio::time::timeout(READ_TIMEOUT, ranking::clear(&mut conn))
        .await
        .map_err(|_| ApiError::Internal("redis timeout clearing the board".into()))??;

    Ok(StatusCode::NO_CONTENT)
}

/// Reject the request unless it carries the configured admin token.
fn authorize(state: &AppState, headers: &HeaderMap) -> Result<(), ApiError> {
    if state.admin_token.is_none() {
        tracing::warn!("admin route called but ADMIN_TOKEN is not configured");
    }
    authorize_with(state.admin_token.as_deref(), headers)
}

/// The token check, split out so it can be unit-tested without constructing an
/// `AppState` (whose Redis handle needs a live connection to build).
fn authorize_with(expected: Option<&str>, headers: &HeaderMap) -> Result<(), ApiError> {
    let Some(expected) = expected else {
        return Err(ApiError::Unavailable);
    };

    match bearer_token(headers) {
        Some(provided) if constant_time_eq(provided.as_bytes(), expected.as_bytes()) => Ok(()),
        _ => Err(ApiError::Unauthorized),
    }
}

/// Pull the token out of an `Authorization: Bearer <token>` header.
fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let value = headers.get(AUTHORIZATION)?.to_str().ok()?;
    let (scheme, token) = value.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("Bearer") {
        return None;
    }
    let token = token.trim();
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

/// Compare two byte strings without short-circuiting on the first difference,
/// so a timing side channel cannot reveal how many leading bytes matched.
///
/// Length is compared first (a length leak is not a secret leak for a
/// fixed-length token); the loop itself is constant-time over the common length.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

async fn remove_from_board(state: &AppState, player_id: &str) -> Result<(), ApiError> {
    let mut conn = state.redis.clone();
    tokio::time::timeout(READ_TIMEOUT, ranking::remove(&mut conn, player_id))
        .await
        .map_err(|_| ApiError::Internal("redis timeout removing the player".into()))??;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::header::AUTHORIZATION;
    use axum::http::HeaderValue;

    fn headers(value: &str) -> HeaderMap {
        let mut map = HeaderMap::new();
        map.insert(AUTHORIZATION, HeaderValue::from_str(value).unwrap());
        map
    }

    #[test]
    fn bearer_token_parses_a_valid_header() {
        assert_eq!(bearer_token(&headers("Bearer s3cret")), Some("s3cret"));
        assert_eq!(bearer_token(&headers("bearer s3cret")), Some("s3cret"));
    }

    #[test]
    fn bearer_token_rejects_malformed_headers() {
        assert_eq!(bearer_token(&headers("s3cret")), None);
        assert_eq!(bearer_token(&headers("Basic s3cret")), None);
        assert_eq!(bearer_token(&headers("Bearer   ")), None);
        assert_eq!(bearer_token(&HeaderMap::new()), None);
    }

    #[test]
    fn constant_time_eq_matches_only_identical_bytes() {
        assert!(constant_time_eq(b"token", b"token"));
        assert!(!constant_time_eq(b"token", b"toker"));
        assert!(!constant_time_eq(b"token", b"token-longer"));
        assert!(!constant_time_eq(b"", b"x"));
        assert!(constant_time_eq(b"", b""));
    }

    #[test]
    fn authorize_is_unavailable_without_a_configured_token() {
        let err = authorize_with(None, &headers("Bearer anything")).unwrap_err();
        assert!(matches!(err, ApiError::Unavailable));
    }

    #[test]
    fn authorize_accepts_the_matching_token_and_rejects_others() {
        assert!(authorize_with(Some("s3cret"), &headers("Bearer s3cret")).is_ok());
        assert!(matches!(
            authorize_with(Some("s3cret"), &headers("Bearer nope")).unwrap_err(),
            ApiError::Unauthorized
        ));
        assert!(matches!(
            authorize_with(Some("s3cret"), &HeaderMap::new()).unwrap_err(),
            ApiError::Unauthorized
        ));
    }
}
