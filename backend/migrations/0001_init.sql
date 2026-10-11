-- Initial schema for the realtime leaderboard.
--
-- `score_events` is the durable, append-only log of accepted submissions. It is
-- idempotent by `event_id`: at-least-once delivery means the same event may be
-- submitted more than once.
--
-- `player_scores` is the materialized best-per-player standing and the source of
-- truth for the Redis sorted set. `best_seq` records the ingest order of the
-- earliest event that achieved `best_score`, so equal scores have a stable,
-- earliest-wins order.

CREATE TABLE score_events (
    event_id    UUID PRIMARY KEY,
    player_id   TEXT NOT NULL,
    -- The upper bound mirrors the API/Redis composite-score limit; scores above
    -- it cannot be ranked faithfully with the f64 encoding.
    score       BIGINT NOT NULL CHECK (score >= 0 AND score <= 1000000000),
    seq         BIGINT GENERATED ALWAYS AS IDENTITY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX score_events_player_id_idx ON score_events (player_id);

CREATE TABLE player_scores (
    player_id  TEXT PRIMARY KEY,
    best_score BIGINT NOT NULL CHECK (best_score >= 0 AND best_score <= 1000000000),
    best_seq   BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supports ranking-order scans from Postgres (e.g. a cold-start / fallback
-- read). The Redis path is primary; rebuild scans order by player_id (PK).
CREATE INDEX player_scores_ranking_idx ON player_scores (best_score DESC, best_seq ASC);
