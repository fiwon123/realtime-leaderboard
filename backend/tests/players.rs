//! Integration tests for `GET /players` (player-id substring search).
//!
//! The board is shared with real data and other test binaries, so these
//! assertions only consider the uniquely-named players this test created.
//! Skipped when Postgres/Redis are unreachable.

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

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

/// Remove a test player from Postgres directly, avoiding a dependency on the
/// admin endpoint (delete/clear) which lives in a later change.
async fn cleanup(state: &realtime_leaderboard::AppState, player: &str) {
    let _ = sqlx::query("DELETE FROM score_events WHERE player_id = $1")
        .bind(player)
        .execute(&state.db)
        .await;
    let _ = sqlx::query("DELETE FROM player_scores WHERE player_id = $1")
        .bind(player)
        .execute(&state.db)
        .await;
}

#[tokio::test]
async fn prefix_search_ranks_closest_match_first() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    // A unique term so real data cannot collide with these players.
    let term = format!("it-rank-{}", Uuid::new_v4());
    let exact = term.clone(); // the id itself — closest possible match
    let short = format!("{term}-a"); // prefix match, short
    let long = format!("{term}-bbbbbbbb"); // prefix match, longer
    let contained = format!("zz{term}zz"); // substring only, not a prefix
    post(&app, &exact, 1).await;
    post(&app, &short, 2).await;
    post(&app, &long, 3).await;
    post(&app, &contained, 4).await;

    let (status, body) = get(&app, &format!("/players?prefix={term}&limit=10")).await;
    assert_eq!(status, StatusCode::OK);

    let players: Vec<&str> = body["players"]
        .as_array()
        .expect("players array")
        .iter()
        .map(|v| v.as_str().unwrap())
        .collect();
    assert_eq!(
        players,
        vec![
            exact.as_str(),
            short.as_str(),
            long.as_str(),
            contained.as_str()
        ],
        "exact match, then prefixes shortest-first, then substrings"
    );

    for player in [&exact, &short, &long, &contained] {
        cleanup(&state, player).await;
    }
}

#[tokio::test]
async fn prefix_search_breaks_ties_by_score() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    // Same term and equal closeness (both prefix matches, same length), so the
    // higher score must come first.
    let term = format!("it-tie-{}", Uuid::new_v4());
    let low = format!("{term}-aa");
    let high = format!("{term}-bb");
    post(&app, &low, 5).await;
    post(&app, &high, 95).await;

    let (status, body) = get(&app, &format!("/players?prefix={term}&limit=10")).await;
    assert_eq!(status, StatusCode::OK);

    let players: Vec<&str> = body["players"]
        .as_array()
        .expect("players array")
        .iter()
        .map(|v| v.as_str().unwrap())
        .collect();
    assert_eq!(
        players,
        vec![high.as_str(), low.as_str()],
        "equally close matches break ties by score descending"
    );

    for player in [&low, &high] {
        cleanup(&state, player).await;
    }
}

#[tokio::test]
async fn prefix_search_does_not_treat_wildcards_as_metacharacters() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let prefix = format!("it-wild-{}", Uuid::new_v4());
    let literal = format!("{prefix}%literal");
    post(&app, &literal, 42).await;

    // A bare `%` must NOT match everything; it matches the literal `%`.
    let (status, body) = get(&app, "/players?prefix=%25&limit=25").await;
    assert_eq!(status, StatusCode::OK);
    let players = body["players"].as_array().expect("players array");
    assert!(
        players.iter().all(|p| p.as_str().unwrap().contains('%')),
        "a literal % must not match ids without one"
    );

    cleanup(&state, &literal).await;
}

#[tokio::test]
async fn prefix_search_rejects_bad_params() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state);

    for uri in [
        "/players",                       // missing prefix
        "/players?prefix=",               // empty prefix
        "/players?prefix=%20%20",         // whitespace-only prefix
        "/players?prefix=alice&limit=0",  // limit below range
        "/players?prefix=alice&limit=26", // limit above range
    ] {
        let (status, body) = get(&app, uri).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "uri {uri}");
        assert!(body["error"].is_string(), "expected a JSON error body");
    }
}
