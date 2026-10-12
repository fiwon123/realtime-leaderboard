//! Integration tests for `POST /scores`.
//!
//! Skipped when Postgres/Redis are unreachable. Random player and event ids keep
//! the tests independent of each other and of existing dev data; each test
//! removes what it wrote.

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use realtime_leaderboard::AppState;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

const KEY: &str = "leaderboard:default";

async fn post(app: &Router, body: Value) -> (StatusCode, Value) {
    post_raw(app, body.to_string()).await
}

async fn post_raw(app: &Router, body: String) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/scores")
                .header("content-type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
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

async fn zscore(state: &AppState, player: &str) -> Option<f64> {
    let mut conn = state.redis.clone();
    redis::cmd("ZSCORE")
        .arg(KEY)
        .arg(player)
        .query_async::<Option<f64>>(&mut conn)
        .await
        .ok()
        .flatten()
}

async fn zrevrank(state: &AppState, player: &str) -> i64 {
    let mut conn = state.redis.clone();
    redis::cmd("ZREVRANK")
        .arg(KEY)
        .arg(player)
        .query_async::<i64>(&mut conn)
        .await
        .expect("ZREVRANK")
}

async fn cleanup(state: &AppState, players: &[&str], event_ids: &[Uuid]) {
    let mut conn = state.redis.clone();
    for player in players {
        let _ = redis::cmd("ZREM")
            .arg(KEY)
            .arg(*player)
            .exec_async(&mut conn)
            .await;
    }
    for event_id in event_ids {
        let _ = sqlx::query("DELETE FROM score_events WHERE event_id = $1")
            .bind(event_id)
            .execute(&state.db)
            .await;
    }
    for player in players {
        let _ = sqlx::query("DELETE FROM player_scores WHERE player_id = $1")
            .bind(*player)
            .execute(&state.db)
            .await;
    }
}

fn unique_player() -> String {
    format!("it-{}", Uuid::new_v4())
}

#[tokio::test]
async fn first_submission_creates_then_replay_is_duplicate() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let event_id = Uuid::new_v4();
    let player = unique_player();
    let body = json!({ "event_id": event_id, "player_id": player, "score": 100 });

    let (status, created) = post(&app, body.clone()).await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(created["duplicate"], json!(false));
    assert_eq!(created["score"], json!(100));

    let (status, replay) = post(&app, body).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(replay["duplicate"], json!(true));

    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM score_events WHERE event_id = $1")
        .bind(event_id)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(count, 1, "a replay must not add a second durable event");

    cleanup(&state, &[&player], &[event_id]).await;
}

#[tokio::test]
async fn higher_score_updates_the_ranking_and_a_later_lower_score_does_not() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let player = unique_player();
    let low = Uuid::new_v4();
    let high = Uuid::new_v4();
    let after = Uuid::new_v4();

    let (status, _) = post(
        &app,
        json!({ "event_id": low, "player_id": player, "score": 10 }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(zscore(&state, &player).await.unwrap().floor(), 10.0);

    let (status, _) = post(
        &app,
        json!({ "event_id": high, "player_id": player, "score": 50 }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(zscore(&state, &player).await.unwrap().floor(), 50.0);

    let (status, _) = post(
        &app,
        json!({ "event_id": after, "player_id": player, "score": 5 }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(
        zscore(&state, &player).await.unwrap().floor(),
        50.0,
        "a later lower score must not demote the player"
    );

    cleanup(&state, &[&player], &[low, high, after]).await;
}

#[tokio::test]
async fn equal_scores_rank_the_earlier_event_first() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let earlier = unique_player();
    let later = unique_player();
    let earlier_event = Uuid::new_v4();
    let later_event = Uuid::new_v4();

    let (status, _) = post(
        &app,
        json!({ "event_id": earlier_event, "player_id": earlier, "score": 77 }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    // Ingested second, so its `seq` is strictly larger.
    let (status, _) = post(
        &app,
        json!({ "event_id": later_event, "player_id": later, "score": 77 }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let rank_earlier = zrevrank(&state, &earlier).await;
    let rank_later = zrevrank(&state, &later).await;
    assert!(
        rank_earlier < rank_later,
        "equal scores must rank the earlier event first (earlier={rank_earlier}, later={rank_later})"
    );

    cleanup(&state, &[&earlier, &later], &[earlier_event, later_event]).await;
}

#[tokio::test]
async fn invalid_payloads_are_rejected() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let cases = [
        json!({ "event_id": Uuid::new_v4(), "player_id": "   ", "score": 1 }),
        json!({ "event_id": Uuid::new_v4(), "player_id": "p", "score": -1 }),
        json!({ "event_id": Uuid::new_v4(), "player_id": "p", "score": 1_000_000_001 }),
    ];

    for case in cases {
        let (status, body) = post(&app, case).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(body["error"].is_string(), "expected a JSON error body");
    }

    let (status, body) = post_raw(&app, "this is not json".to_string()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].is_string(), "expected a JSON error body");
}

#[tokio::test]
async fn accepts_boundary_scores_and_player_ids() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    for score in [0, 1_000_000_000] {
        let event_id = Uuid::new_v4();
        let player = unique_player();
        let (status, body) = post(
            &app,
            json!({ "event_id": event_id, "player_id": player, "score": score }),
        )
        .await;
        assert_eq!(
            status,
            StatusCode::CREATED,
            "score {score} must be accepted"
        );
        assert_eq!(body["score"], json!(score));
        cleanup(&state, &[&player], &[event_id]).await;
    }

    let event_id = Uuid::new_v4();
    let player = "x".repeat(128);
    let (status, _) = post(
        &app,
        json!({ "event_id": event_id, "player_id": player, "score": 1 }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CREATED,
        "a 128-byte player_id must be accepted"
    );
    cleanup(&state, &[&player], &[event_id]).await;
}
