//! Integration test for `GET /healthz`.
//!
//! Skipped when Postgres/Redis are not reachable so `cargo test` stays green
//! without the compose services.

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn healthz_reports_ok_when_services_are_up() {
    let Some(state) = common::try_state().await else {
        eprintln!("skipping healthz test: Postgres/Redis not reachable");
        return;
    };

    let response = realtime_leaderboard::app(state)
        .oneshot(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
