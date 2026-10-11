//! Liveness/readiness endpoint that checks both backing stores.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Serialize;

use crate::state::AppState;

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
    postgres: bool,
    redis: bool,
}

/// `GET /healthz` — 200 when Postgres and Redis both respond, 503 otherwise.
pub async fn healthz(State(state): State<AppState>) -> impl IntoResponse {
    let postgres = sqlx::query("SELECT 1").execute(&state.db).await.is_ok();

    let mut redis = state.redis.clone();
    let redis = redis::cmd("PING")
        .query_async::<String>(&mut redis)
        .await
        .is_ok();

    let healthy = postgres && redis;
    let (status, label) = if healthy {
        (StatusCode::OK, "ok")
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "degraded")
    };

    (
        status,
        Json(HealthBody {
            status: label,
            postgres,
            redis,
        }),
    )
}
