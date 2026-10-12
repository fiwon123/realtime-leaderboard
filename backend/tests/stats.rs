//! Integration tests for `GET /stats`.
//!
//! Skipped when Postgres/Redis are not reachable so `cargo test` stays green
//! without the compose services.

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use realtime_leaderboard::AppState;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

use realtime_leaderboard::services::ranking::LEADERBOARD_KEY;

async fn get(app: &Router, uri: &str) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), 64 * 1024)
        .await
        .unwrap();
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(Value::Null)
    };
    (status, value)
}

async fn post(app: &Router, player: &str, score: i64) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/scores")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "event_id": Uuid::new_v4(), "player_id": player, "score": score })
                        .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
}

async fn cleanup(state: &AppState, players: &[&str]) {
    let mut conn = state.redis.clone();
    for player in players {
        let _ = redis::cmd("ZREM")
            .arg(LEADERBOARD_KEY)
            .arg(*player)
            .exec_async(&mut conn)
            .await;
        let _ = sqlx::query("DELETE FROM score_events WHERE player_id = $1")
            .bind(*player)
            .execute(&state.db)
            .await;
        let _ = sqlx::query("DELETE FROM player_scores WHERE player_id = $1")
            .bind(*player)
            .execute(&state.db)
            .await;
    }
}

#[tokio::test]
async fn stats_reports_board_size_and_peak_score() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let low = format!("it-{}", Uuid::new_v4());
    let high = format!("it-{}", Uuid::new_v4());
    post(&app, &low, 5).await;
    post(&app, &high, 80).await;

    let (status, body) = get(&app, "/stats").await;
    assert_eq!(status, StatusCode::OK);

    // The board is shared with real data and other tests, so assert our players
    // are counted and our peak is present — never an exact board size.
    assert!(
        body["players"].as_u64().unwrap() >= 2,
        "both posted players must be counted"
    );
    assert!(
        body["top_score"].as_i64().unwrap() >= 80,
        "top_score must be at least the highest posted score"
    );

    cleanup(&state, &[&low, &high]).await;
}
