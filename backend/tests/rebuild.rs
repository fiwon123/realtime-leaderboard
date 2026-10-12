//! Integration tests for the ranking-rebuild path.
//!
//! Skipped when Postgres/Redis are unreachable. Random player ids keep the
//! tests independent of each other, but the `player_scores` table is shared
//! with real data and other tests, so assertions are relative to whatever it
//! already holds rather than to a fixed count. Each test removes what it wrote.

mod common;

use realtime_leaderboard::services::ranking::{self, LEADERBOARD_KEY};
use realtime_leaderboard::services::rebuild::rebuild;
use realtime_leaderboard::storage::scores;
use uuid::Uuid;

fn unique_player() -> String {
    format!("it-{}", Uuid::new_v4())
}

async fn cleanup(state: &realtime_leaderboard::AppState, players: &[&str]) {
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
async fn rebuild_restores_the_leaderboard_from_postgres() {
    let Some(state) = common::try_migrated_state().await else {
        eprintln!("skipping: Postgres/Redis not reachable");
        return;
    };

    // Seed standings through storage so we control `seq`.
    let player_a = unique_player();
    let seq_a = scores::insert_event(&state.db, Uuid::new_v4(), &player_a, 50)
        .await
        .unwrap()
        .unwrap();
    scores::upsert_player_best(&state.db, &player_a, 50, seq_a)
        .await
        .unwrap();

    let player_b = unique_player();
    let seq_b = scores::insert_event(&state.db, Uuid::new_v4(), &player_b, 30)
        .await
        .unwrap()
        .unwrap();
    scores::upsert_player_best(&state.db, &player_b, 30, seq_b)
        .await
        .unwrap();

    // Corrupt the board: a wrong score for an existing player, a wrong score
    // for a player, and a ghost member with no Postgres standing.
    let mut conn = state.redis.clone();
    redis::cmd("DEL")
        .arg(LEADERBOARD_KEY)
        .exec_async(&mut conn)
        .await
        .unwrap();
    redis::cmd("ZADD")
        .arg(LEADERBOARD_KEY)
        .arg(999)
        .arg(&player_a)
        .exec_async(&mut conn)
        .await
        .unwrap();
    redis::cmd("ZADD")
        .arg(LEADERBOARD_KEY)
        .arg(1)
        .arg("ghost-player")
        .exec_async(&mut conn)
        .await
        .unwrap();

    // `rebuild` projects every `player_scores` row, so the board — and the
    // returned count — also include whatever real data is already there.
    // Compare against the table's actual size, never a hard-coded 2.
    let expected = scores::all_player_bests(&state.db).await.unwrap().len();
    let count = rebuild(&state).await.unwrap();
    assert_eq!(
        count, expected,
        "every Postgres standing must be written, and nothing else"
    );

    let card: i64 = redis::cmd("ZCARD")
        .arg(LEADERBOARD_KEY)
        .query_async(&mut conn)
        .await
        .unwrap();
    assert_eq!(
        card as usize, expected,
        "the board must match Postgres exactly, so the ghost is removed"
    );

    let ghost: Option<f64> = redis::cmd("ZSCORE")
        .arg(LEADERBOARD_KEY)
        .arg("ghost-player")
        .query_async(&mut conn)
        .await
        .unwrap();
    assert!(ghost.is_none(), "the ghost member must be removed");

    let raw_a: Option<f64> = redis::cmd("ZSCORE")
        .arg(LEADERBOARD_KEY)
        .arg(&player_a)
        .query_async(&mut conn)
        .await
        .unwrap();
    let score_a = raw_a.unwrap();
    assert_eq!(score_a, ranking::composite_score(50, seq_a));
    assert_eq!(ranking::decode_score(score_a), 50);

    let raw_b: Option<f64> = redis::cmd("ZSCORE")
        .arg(LEADERBOARD_KEY)
        .arg(&player_b)
        .query_async(&mut conn)
        .await
        .unwrap();
    let score_b = raw_b.unwrap();
    assert_eq!(score_b, ranking::composite_score(30, seq_b));

    let raw_a: Option<i64> = redis::cmd("ZREVRANK")
        .arg(LEADERBOARD_KEY)
        .arg(&player_a)
        .query_async(&mut conn)
        .await
        .unwrap();
    let rank_a = raw_a.unwrap();
    let raw_b: Option<i64> = redis::cmd("ZREVRANK")
        .arg(LEADERBOARD_KEY)
        .arg(&player_b)
        .query_async(&mut conn)
        .await
        .unwrap();
    let rank_b = raw_b.unwrap();
    assert!(rank_a < rank_b, "the higher score must rank first");

    cleanup(&state, &[&player_a, &player_b]).await;
}
