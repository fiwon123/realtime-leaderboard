//! API error type and its HTTP representation.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;

/// Errors surfaced by route handlers.
///
/// Variant messages are safe to show to clients except [`ApiError::Internal`],
/// whose detail is logged but replaced with a generic message on the wire.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("resource not found")]
    NotFound,
    /// Caller-facing validation message. Only put text here that is safe to
    /// show a client — never an upstream/internal error's `to_string()`.
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("unauthorized")]
    Unauthorized,
    #[error("service unavailable")]
    Unavailable,
    #[error("internal error: {0}")]
    Internal(String),
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        // The detail is logged and redacted on the wire by `into_response`.
        ApiError::Internal(format!("database error: {err}"))
    }
}

// Redis is a projection on the ingest path (see `services::ingest`), where its
// errors are logged rather than surfaced. This conversion is for read paths,
// where Redis is required to answer and an outage is a server error.
impl From<redis::RedisError> for ApiError {
    fn from(err: redis::RedisError) -> Self {
        ApiError::Internal(format!("redis error: {err}"))
    }
}

impl ApiError {
    fn status(&self) -> StatusCode {
        match self {
            ApiError::NotFound => StatusCode::NOT_FOUND,
            ApiError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ApiError::Unauthorized => StatusCode::UNAUTHORIZED,
            ApiError::Unavailable => StatusCode::SERVICE_UNAVAILABLE,
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

/// The JSON body carried by every [`ApiError`] response.
///
/// Public and [`ToSchema`]-derived so the OpenAPI document can describe error
/// responses with a real schema (and clients can generate an error type) rather
/// than a bare description.
#[derive(Serialize, ToSchema)]
pub struct ErrorBody {
    /// Human-readable, client-safe error message.
    #[schema(example = "bad request: score must be between 0 and 1000000000")]
    pub error: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        let message = match &self {
            ApiError::Internal(_) => {
                tracing::error!(error = %self, "internal error");
                "internal server error".to_string()
            }
            other => other.to_string(),
        };

        (status, Json(ErrorBody { error: message })).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_variants_to_status_codes() {
        assert_eq!(
            ApiError::NotFound.into_response().status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            ApiError::BadRequest("x".into()).into_response().status(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            ApiError::Unauthorized.into_response().status(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            ApiError::Unavailable.into_response().status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            ApiError::Internal("x".into()).into_response().status(),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }

    #[tokio::test]
    async fn internal_detail_is_not_leaked() {
        let response = ApiError::Internal("db password is hunter2".into()).into_response();
        let bytes = axum::body::to_bytes(response.into_body(), 1024)
            .await
            .expect("body");
        let text = String::from_utf8(bytes.to_vec()).expect("utf8");
        assert!(text.contains("internal server error"));
        assert!(!text.contains("hunter2"));
    }
}
