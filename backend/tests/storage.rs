//! Integration tests for the Postgres storage layer.
//!
//! Skipped when Postgres is unreachable. Rows are keyed by random ids so the
//! tests do not interfere with each other or with existing dev data.

mod common;

use realtime_leaderboard::storage::scores::{
    all_player_bests, insert_event, player_best, upsert_player_best,
};
use uuid::Uuid;

async fn cleanup(pool: &sqlx::PgPool, event_id: Uuid, player_id: &str) {
    let _ = sqlx::query("DELETE FROM score_events WHERE event_id = $1")
        .bind(event_id)
        .execute(pool)
        .await;
    let _ = sqlx::query("DELETE FROM player_scores WHERE player_id = $1")
        .bind(player_id)
        .execute(pool)
        .await;
}

fn unique_player() -> String {
    format!("it-{}", Uuid::new_v4())
}

#[tokio::test]
async fn insert_event_is_idempotent_on_event_id() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };

    let event_id = Uuid::new_v4();
    let player = unique_player();

    let first = insert_event(&state.db, event_id, &player, 10)
        .await
        .unwrap();
    assert!(first.is_some(), "first insert should return a seq");

    let replay = insert_event(&state.db, event_id, &player, 10)
        .await
        .unwrap();
    assert!(replay.is_none(), "a replayed event must not insert again");

    cleanup(&state.db, event_id, &player).await;
}

#[tokio::test]
async fn upsert_materializes_a_higher_score() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let player = unique_player();

    assert!(upsert_player_best(&state.db, &player, 10, 1).await.unwrap());
    assert!(upsert_player_best(&state.db, &player, 20, 2).await.unwrap());

    let best = player_best(&state.db, &player).await.unwrap().unwrap();
    assert_eq!(best.best_score, 20);
    assert_eq!(best.best_seq, 2);

    cleanup(&state.db, Uuid::nil(), &player).await;
}

#[tokio::test]
async fn upsert_ignores_a_lower_score() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let player = unique_player();

    assert!(upsert_player_best(&state.db, &player, 20, 2).await.unwrap());
    assert!(!upsert_player_best(&state.db, &player, 10, 3).await.unwrap());

    let best = player_best(&state.db, &player).await.unwrap().unwrap();
    assert_eq!((best.best_score, best.best_seq), (20, 2));

    cleanup(&state.db, Uuid::nil(), &player).await;
}

#[tokio::test]
async fn equal_score_keeps_the_earliest_seq() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let player = unique_player();

    assert!(upsert_player_best(&state.db, &player, 10, 5).await.unwrap());
    // Equal score with a later seq must not displace the earlier standing.
    assert!(!upsert_player_best(&state.db, &player, 10, 9).await.unwrap());
    // Equal score with an earlier seq (out-of-order arrival) does.
    assert!(upsert_player_best(&state.db, &player, 10, 3).await.unwrap());

    let best = player_best(&state.db, &player).await.unwrap().unwrap();
    assert_eq!((best.best_score, best.best_seq), (10, 3));

    cleanup(&state.db, Uuid::nil(), &player).await;
}

#[tokio::test]
async fn all_player_bests_returns_written_rows() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };
    let player = unique_player();

    upsert_player_best(&state.db, &player, 42, 1).await.unwrap();
    let all = all_player_bests(&state.db).await.unwrap();
    assert!(all.iter().any(|row| row.player_id == player));

    cleanup(&state.db, Uuid::nil(), &player).await;
}
