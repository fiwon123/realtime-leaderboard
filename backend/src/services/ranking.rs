//! Redis sorted-set ranking.
//!
//! A player's position is a total order over `(score, seq)`: higher score wins,
//! and on equal score the earlier event (smaller `seq`) wins. Redis orders a
//! sorted set by its `score`, so that pair is packed into one `f64`.

use redis::aio::ConnectionManager;

/// Sorted-set key holding the single default leaderboard.
pub const LEADERBOARD_KEY: &str = "leaderboard:default";

/// Composite Redis score for a standing.
///
/// The integer part is the score; the fractional part is in `(0, 1]` and
/// decreases as `seq` grows, so a smaller `seq` yields a larger value. Distinct
/// integer scores differ by at least 1, so their ranges never overlap.
///
/// f64 has a 52-bit mantissa, so the tie-break fraction stays distinct while
/// `score <= 1e9` and `seq` is below roughly 10 million — beyond that, ties
/// within one integer score may collapse. A follow-up can switch to a two-key
/// scheme if a single board ever exceeds that.
pub fn composite_score(score: i64, seq: i64) -> f64 {
    score as f64 + 1.0 / (1.0 + seq as f64)
}

/// Integer score recovered from a composite value (for display).
pub fn decode_score(composite: f64) -> i64 {
    composite.floor() as i64
}

/// Project a standing into the sorted set, only ever raising a member's value.
///
/// `ZADD ... GT` makes this idempotent and safe to re-apply from the
/// authoritative Postgres state: a stale or lower standing cannot demote a
/// player.
pub async fn apply_standing(
    conn: &mut ConnectionManager,
    player_id: &str,
    score: i64,
    seq: i64,
) -> redis::RedisResult<()> {
    redis::cmd("ZADD")
        .arg(LEADERBOARD_KEY)
        .arg("GT")
        .arg(composite_score(score, seq))
        .arg(player_id)
        .query_async::<i64>(conn)
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn higher_score_sorts_higher() {
        assert!(composite_score(20, 1) > composite_score(10, 1));
    }

    #[test]
    fn equal_score_prefers_earlier_seq() {
        assert!(composite_score(10, 1) > composite_score(10, 2));
    }

    #[test]
    fn different_scores_never_overlap() {
        // Even the worst case for a low score beats the best case for one below.
        assert!(composite_score(10, i64::MAX) > composite_score(9, 1));
    }

    #[test]
    fn decode_recovers_the_integer_score() {
        assert_eq!(decode_score(composite_score(0, 1)), 0);
        assert_eq!(
            decode_score(composite_score(1_000_000_000, 7)),
            1_000_000_000
        );
    }
}
