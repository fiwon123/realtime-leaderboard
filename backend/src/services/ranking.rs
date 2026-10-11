//! Redis sorted-set ranking.
//!
//! A player's position is a total order over `(score, seq)`: higher score wins,
//! and on equal score the earlier event (smaller `seq`) wins. Redis orders a
//! sorted set by its `score` (an `f64`), so that pair is packed into one value.

use redis::aio::ConnectionManager;

/// Sorted-set key holding the single default leaderboard.
pub const LEADERBOARD_KEY: &str = "leaderboard:default";

/// Number of distinct tie-break levels in the fractional part.
///
/// `1e9` (the score ceiling) occupies 30 bits, leaving 22 fraction bits of the
/// f64 mantissa. Using `2^22` levels makes the step between adjacent `seq`
/// values `2^-22`, which is two ULPs at `score = 1e9` — so equal-score ordering
/// stays exact for every representable score, independent of magnitude.
const SEQ_LEVELS: i64 = 1 << 22;

/// Composite Redis score for a standing.
///
/// The integer part is the score. The fraction decreases as `seq` grows, so a
/// smaller `seq` yields a larger value; distinct integer scores differ by at
/// least 1, so their ranges never overlap.
///
/// Smaller `seq` values are ordered exactly. Beyond [`SEQ_LEVELS`] (~4.2M)
/// events the fraction saturates, so ties among much later events at the same
/// score may collapse to one Redis score. A follow-up can switch to a two-key
/// or lexicographic scheme if a single board ever exceeds that within-score
/// depth.
pub fn composite_score(score: i64, seq: i64) -> f64 {
    let rank = seq.clamp(1, SEQ_LEVELS - 1);
    let fraction = (SEQ_LEVELS - rank) as f64 / SEQ_LEVELS as f64;
    score as f64 + fraction
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

/// 1-based rank and decoded best score for a player with a standing, or `None`
/// when the player has no live entry.
pub async fn rank_of(
    conn: &mut ConnectionManager,
    player_id: &str,
) -> redis::RedisResult<Option<(u64, i64)>> {
    let position: Option<i64> = redis::cmd("ZREVRANK")
        .arg(LEADERBOARD_KEY)
        .arg(player_id)
        .query_async(conn)
        .await?;

    let Some(position) = position else {
        return Ok(None);
    };

    let composite: Option<f64> = redis::cmd("ZSCORE")
        .arg(LEADERBOARD_KEY)
        .arg(player_id)
        .query_async(conn)
        .await?;

    Ok(Some((
        position as u64 + 1,
        decode_score(composite.unwrap_or_default()),
    )))
}

/// The board from `start` to `stop` (inclusive), highest first, as
/// `(member, composite)` pairs.
pub async fn top(
    conn: &mut ConnectionManager,
    start: i64,
    stop: i64,
) -> redis::RedisResult<Vec<(String, f64)>> {
    redis::cmd("ZREVRANGE")
        .arg(LEADERBOARD_KEY)
        .arg(start)
        .arg(stop)
        .arg("WITHSCORES")
        .query_async::<Vec<(String, f64)>>(conn)
        .await
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
    fn tie_break_is_exact_at_the_top_of_the_score_range() {
        // Regression guard for the old `1/(1+seq)` encoding, which collapsed
        // adjacent ties far below this score.
        for score in [0, 1, 1_000_000, 1_000_000_000] {
            assert!(
                composite_score(score, 3_000_000) > composite_score(score, 3_000_001),
                "adjacent tie broke at score {score}"
            );
            assert_eq!(decode_score(composite_score(score, 1)), score);
            assert_eq!(decode_score(composite_score(score, 3_000_000)), score);
        }
    }

    #[test]
    fn decode_recovers_the_integer_score() {
        assert_eq!(decode_score(composite_score(0, 1)), 0);
        assert_eq!(
            decode_score(composite_score(1_000_000_000, 7)),
            1_000_000_000
        );
    }

    #[test]
    fn seq_beyond_the_cap_saturates() {
        // Documented limitation: once the tie-break levels are exhausted, extreme
        // `seq` values map to the same fraction.
        assert_eq!(
            composite_score(100, SEQ_LEVELS),
            composite_score(100, SEQ_LEVELS + 1)
        );
    }
}
