//! Integration tests for the token-gated admin routes.
//!
//! Destructive: the live `DELETE /scores` path is exercised only in an
//! `#[ignore]`d test, since it clears the shared board (real data lives there).
//! Everything else uses throwaway player ids or a rolled-back transaction.
//! Skipped when Postgres/Redis are unreachable.

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use realtime_leaderboard::services::ranking::{self, LEADERBOARD_KEY};
use realtime_leaderboard::storage::scores;
use realtime_leaderboard::AppState;
use serde_json::Value;
use tower::ServiceExt;
use uuid::Uuid;

const TOKEN: &str = "it-admin-token";

// Admin tests share the board/table with real data, so they run one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn unique_player() -> String {
    format!("it-admin-{}", Uuid::new_v4())
}

/// Build an app whose state carries `TOKEN` as the admin secret.
async fn admin_app() -> Option<AppState> {
    let mut state = common::try_migrated_state().await?;
    state.admin_token = Some(TOKEN.to_string());
    Some(state)
}

async fn send(app: &Router, method: &str, uri: &str, token: Option<&str>) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(token) = token {
        builder = builder.header("authorization", format!("Bearer {token}"));
    }
    let response = app
        .clone()
        .oneshot(builder.body(Body::empty()).unwrap())
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

/// Write a standing through storage and project it into Redis, so both stores
/// agree on the player before a test acts.
async fn seed(state: &AppState, player: &str, score: i64) {
    let seq = scores::insert_event(&state.db, Uuid::new_v4(), player, score)
        .await
        .unwrap()
        .unwrap();
    scores::upsert_player_best(&state.db, player, score, seq)
        .await
        .unwrap();
    let mut conn = state.redis.clone();
    ranking::apply_standing(&mut conn, player, score, seq)
        .await
        .unwrap();
}

async fn zscore(state: &AppState, player: &str) -> Option<f64> {
    let mut conn = state.redis.clone();
    redis::cmd("ZSCORE")
        .arg(LEADERBOARD_KEY)
        .arg(player)
        .query_async(&mut conn)
        .await
        .unwrap()
}

async fn player_rows(state: &AppState, player: &str) -> (i64, i64) {
    let events: i64 = sqlx::query_scalar("SELECT count(*) FROM score_events WHERE player_id = $1")
        .bind(player)
        .fetch_one(&state.db)
        .await
        .unwrap();
    let standings: i64 =
        sqlx::query_scalar("SELECT count(*) FROM player_scores WHERE player_id = $1")
            .bind(player)
            .fetch_one(&state.db)
            .await
            .unwrap();
    (events, standings)
}

async fn cleanup(state: &AppState, player: &str) {
    let mut conn = state.redis.clone();
    let _ = redis::cmd("ZREM")
        .arg(LEADERBOARD_KEY)
        .arg(player)
        .exec_async(&mut conn)
        .await;
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
async fn admin_routes_are_disabled_without_a_token() {
    let _guard = SERIAL.lock().await;
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    // `try_migrated_state` carries no admin token.
    let app = realtime_leaderboard::app(state);

    for (method, uri) in [
        ("DELETE", format!("/players/{}", unique_player()).as_str()),
        ("DELETE", "/scores"),
    ] {
        let (status, _) = send(&app, method, uri, Some(TOKEN)).await;
        assert_eq!(
            status,
            StatusCode::SERVICE_UNAVAILABLE,
            "{method} {uri} must be disabled without ADMIN_TOKEN"
        );
    }
}

#[tokio::test]
async fn admin_routes_reject_a_missing_or_wrong_token() {
    let _guard = SERIAL.lock().await;
    let Some(state) = admin_app().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let player = unique_player();
    seed(&state, &player, 55).await;

    let uri = format!("/players/{player}");
    for token in [None, Some("wrong-token")] {
        let (status, body) = send(&app, "DELETE", &uri, token).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "token {token:?}");
        assert!(body["error"].is_string(), "expected a JSON error body");
    }
    let (status, _) = send(&app, "DELETE", "/scores", None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // Nothing may have been removed.
    assert!(zscore(&state, &player).await.is_some());
    assert_eq!(player_rows(&state, &player).await, (1, 1));

    cleanup(&state, &player).await;
}

#[tokio::test]
async fn delete_player_removes_it_from_both_stores() {
    let _guard = SERIAL.lock().await;
    let Some(state) = admin_app().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let player = unique_player();
    seed(&state, &player, 55).await;
    assert!(zscore(&state, &player).await.is_some());

    let (status, _) = send(&app, "DELETE", &format!("/players/{player}"), Some(TOKEN)).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    assert_eq!(player_rows(&state, &player).await, (0, 0));
    assert!(zscore(&state, &player).await.is_none());

    // The rank read now 404s through the same router.
    let (status, body) = send(&app, "GET", &format!("/players/{player}/rank"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(body["error"].is_string());

    cleanup(&state, &player).await;
}

#[tokio::test]
async fn delete_player_is_idempotent_for_unknown_ids() {
    let _guard = SERIAL.lock().await;
    let Some(state) = admin_app().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state);

    let (status, _) = send(
        &app,
        "DELETE",
        &format!("/players/{}", unique_player()),
        Some(TOKEN),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn delete_player_rejects_invalid_ids() {
    let _guard = SERIAL.lock().await;
    let Some(state) = admin_app().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state);

    let overlong = "x".repeat(129);
    for uri in [
        "/players/%20%20".to_string(), // blank after decoding
        format!("/players/{overlong}"),
    ] {
        let (status, body) = send(&app, "DELETE", &uri, Some(TOKEN)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "uri {uri}");
        assert!(body["error"].is_string(), "expected a JSON error body");
    }
}

#[tokio::test]
async fn clear_all_empties_the_tables_and_a_rollback_restores_them() {
    let _guard = SERIAL.lock().await;
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };

    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM player_scores")
        .fetch_one(&state.db)
        .await
        .unwrap();

    // `clear_all` takes an executor, so the live rows survive the test.
    let mut tx = state.db.begin().await.unwrap();
    scores::clear_all(&mut *tx).await.unwrap();

    let during: i64 = sqlx::query_scalar("SELECT count(*) FROM player_scores")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    assert_eq!(
        during, 0,
        "clear_all must empty the standings within its tx"
    );

    tx.rollback().await.unwrap();

    let after: i64 = sqlx::query_scalar("SELECT count(*) FROM player_scores")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(after, before, "rollback must restore the live standings");
}

#[tokio::test]
async fn ranking_clear_drops_the_board_and_rebuild_restores_it() {
    let _guard = SERIAL.lock().await;
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };

    let mut conn = state.redis.clone();
    ranking::clear(&mut conn).await.unwrap();
    assert_eq!(ranking::count(&mut conn).await.unwrap(), 0);

    // Rebuild from the durable source, mirroring `rebuild.rs`'s recovery path.
    let rebuilt = realtime_leaderboard::services::rebuild::rebuild(&state)
        .await
        .unwrap();
    let expected = scores::all_player_bests(&state.db).await.unwrap().len();
    assert_eq!(rebuilt, expected);
    assert_eq!(ranking::count(&mut conn).await.unwrap() as usize, expected);
}

/// Destructive end-to-end check of `DELETE /scores`. Ignored by default because
/// it wipes the shared board; run against a disposable database.
#[tokio::test]
#[ignore = "clears the whole board; run against a disposable database"]
async fn clear_scores_endpoint_empties_both_stores() {
    let _guard = SERIAL.lock().await;
    let Some(state) = admin_app().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let app = realtime_leaderboard::app(state.clone());

    let (status, _) = send(&app, "DELETE", "/scores", Some(TOKEN)).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let events: i64 = sqlx::query_scalar("SELECT count(*) FROM score_events")
        .fetch_one(&state.db)
        .await
        .unwrap();
    let standings: i64 = sqlx::query_scalar("SELECT count(*) FROM player_scores")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!((events, standings), (0, 0));
    assert_eq!(ranking::count(&mut state.redis.clone()).await.unwrap(), 0);
}
