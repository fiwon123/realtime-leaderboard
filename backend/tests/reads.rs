//! Integration tests for rank and leaderboard reads.
//!
//! Tests within one binary run in parallel, so a file-static mutex serializes
//! these reads tests against each other — absolute ranks and paging are
//! otherwise nondeterministic. Skipped when Postgres/Redis are unreachable.

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use realtime_leaderboard::AppState;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

const KEY: &str = "leaderboard:default";

static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

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
    let (status, _) = post_raw(
        app,
        json!({ "event_id": Uuid::new_v4(), "player_id": player, "score": score }).to_string(),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
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

/// Exact 1-based rank, computed directly from Redis: members with a strictly
/// higher composite, plus one. Independent of other members in the set.
async fn expected_rank(state: &AppState, player: &str) -> u64 {
    let mut conn = state.redis.clone();
    let composite: Option<f64> = redis::cmd("ZSCORE")
        .arg(KEY)
        .arg(player)
        .query_async(&mut conn)
        .await
        .unwrap();
    let composite = composite.unwrap();
    let above: i64 = redis::cmd("ZCOUNT")
        .arg(KEY)
        .arg(format!("({composite}"))
        .arg("+inf")
        .query_async(&mut conn)
        .await
        .unwrap();
    above as u64 + 1
}

async fn cleanup(state: &AppState, players: &[&str]) {
    let mut conn = state.redis.clone();
    for player in players {
        let _ = redis::cmd("ZREM")
            .arg(KEY)
            .arg(*player)
            .exec_async(&mut conn)
            .await;
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
async fn rank_endpoint_reports_one_based_position_and_score() {
    let _guard = SERIAL.lock().await;
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let above = unique_player();
    let target = unique_player();
    let below = unique_player();
    post(&app, &above, 70).await;
    post(&app, &target, 50).await;
    post(&app, &below, 30).await;

    let expected = expected_rank(&state, &target).await;
    let (status, body) = get(&app, &format!("/players/{target}/rank")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["player_id"], json!(target));
    assert_eq!(body["rank"], json!(expected));
    assert_eq!(body["score"], json!(50));

    cleanup(&state, &[&above, &target, &below]).await;
}

#[tokio::test]
async fn rank_endpoint_returns_not_found_for_unknown_player() {
    let _guard = SERIAL.lock().await;
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let (status, body) = get(&app, &format!("/players/{}/rank", unique_player())).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(body["error"].is_string(), "expected a JSON error body");
}

#[tokio::test]
async fn leaderboard_returns_entries_in_descending_score_order() {
    let _guard = SERIAL.lock().await;
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let mut players = Vec::new();
    for score in [30, 90, 60] {
        let player = unique_player();
        post(&app, &player, score).await;
        players.push((player, score));
    }

    let (status, body) = get(&app, "/leaderboard?limit=100").await;
    assert_eq!(status, StatusCode::OK);

    let entries = body["entries"].as_array().expect("entries array");
    let mut seen = Vec::new();
    for entry in entries {
        let player_id = entry["player_id"].as_str().unwrap();
        if let Some((_, expected_score)) = players.iter().find(|(id, _)| id == player_id) {
            assert_eq!(
                entry["score"].as_i64().unwrap(),
                *expected_score,
                "decoded score must equal the posted best"
            );
            seen.push(*expected_score);
        }
    }
    assert_eq!(seen.len(), 3, "all three players must be present");
    assert_eq!(seen, vec![90, 60, 30], "must be ordered highest first");

    // Ranks across our entries must strictly increase with position.
    let mut ranks = Vec::new();
    for entry in entries {
        if players
            .iter()
            .any(|(id, _)| id == entry["player_id"].as_str().unwrap())
        {
            ranks.push(entry["rank"].as_u64().unwrap());
        }
    }
    assert!(ranks.windows(2).all(|w| w[0] < w[1]), "ranks must increase");

    cleanup(
        &state,
        &players
            .iter()
            .map(|(id, _)| id.as_str())
            .collect::<Vec<_>>(),
    )
    .await;
}

#[tokio::test]
async fn leaderboard_pagination_respects_limit_and_offset() {
    let _guard = SERIAL.lock().await;
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let mut players = Vec::new();
    for score in [50, 40, 30, 20, 10] {
        let player = unique_player();
        post(&app, &player, score).await;
        players.push((player, score));
    }

    let mut seen = Vec::new();
    for offset in [0, 2, 4] {
        let (status, body) = get(&app, &format!("/leaderboard?limit=2&offset={offset}")).await;
        assert_eq!(status, StatusCode::OK);
        for entry in body["entries"].as_array().expect("entries array") {
            let player_id = entry["player_id"].as_str().unwrap();
            if let Some((_, expected_score)) = players.iter().find(|(id, _)| id == player_id) {
                assert_eq!(entry["score"].as_i64().unwrap(), *expected_score);
                seen.push(*expected_score);
            }
        }
    }

    assert_eq!(
        seen,
        vec![50, 40, 30, 20, 10],
        "paging must splice the board in order"
    );

    cleanup(
        &state,
        &players
            .iter()
            .map(|(id, _)| id.as_str())
            .collect::<Vec<_>>(),
    )
    .await;
}

#[tokio::test]
async fn out_of_range_limit_is_rejected() {
    let _guard = SERIAL.lock().await;
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    for uri in ["/leaderboard?limit=0", "/leaderboard?limit=101"] {
        let (status, body) = get(&app, uri).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "uri {uri}");
        assert!(body["error"].is_string(), "expected a JSON error body");
    }
}
