//! Liveness/readiness endpoint that checks both backing stores.

use std::time::Duration;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Serialize;
use tokio::time::timeout;

use crate::state::AppState;

/// A probe that has not answered within this window counts as unhealthy, so a
/// hung dependency cannot make `/healthz` itself hang.
const PROBE_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
    postgres: bool,
    redis: bool,
}

/// `GET /healthz` — 200 when Postgres and Redis both respond, 503 otherwise.
pub async fn healthz(State(state): State<AppState>) -> impl IntoResponse {
    let postgres = matches!(
        timeout(PROBE_TIMEOUT, sqlx::query("SELECT 1").execute(&state.db)).await,
        Ok(Ok(_))
    );

    let redis = {
        let mut conn = state.redis.clone();
        matches!(
            timeout(
                PROBE_TIMEOUT,
                redis::cmd("PING").query_async::<String>(&mut conn)
            )
            .await,
            Ok(Ok(_))
        )
    };

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
