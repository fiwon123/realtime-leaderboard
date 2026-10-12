//! Integration test for the served OpenAPI document and Swagger UI.
//!
//! These routes do no I/O, but building the app needs an `AppState`, so the
//! test is skipped when Postgres/Redis are not reachable and a bare
//! `cargo test` stays green without the compose services.

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn swagger_ui_and_spec_are_served() {
    let Some(state) = common::try_state().await else {
        eprintln!("skipping openapi test: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state);

    let ui = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/swagger-ui/")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(ui.status(), StatusCode::OK, "Swagger UI is not served");

    let spec_response = app
        .oneshot(
            Request::builder()
                .uri("/swagger-ui/api-docs/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        spec_response.status(),
        StatusCode::OK,
        "OpenAPI document is not served"
    );

    let body = axum::body::to_bytes(spec_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let spec: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // The served document must describe every route the app exposes.
    for path in [
        "/healthz",
        "/scores",
        "/players/{player_id}/rank",
        "/leaderboard",
    ] {
        assert!(
            spec["paths"].get(path).is_some(),
            "served spec is missing {path}"
        );
    }
}
