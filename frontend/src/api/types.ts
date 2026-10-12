// Request/response types mirroring `backend/openapi.json`.
//
// The spec is small and stable, so these are hand-written; deriving them with
// `openapi-typescript` is a possible follow-up. Keep them in sync with the
// `components.schemas` block of the committed spec.

export interface ScoreEvent {
  event_id: string
  player_id: string
  score: number
}

export interface ScoreEventResponse extends ScoreEvent {
  /** `true` when this `event_id` had already been ingested (HTTP 200 replay). */
  duplicate: boolean
}

export interface RankResponse {
  player_id: string
  rank: number
  score: number
}

export interface LeaderboardEntry {
  rank: number
  player_id: string
  score: number
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  /** Players on the board in total, independent of the requested page. */
  total: number
}

/** `GET /stats` — board size and peak score. */
export interface StatsResponse {
  players: number
  /** Highest score on the board, or `null` when it is empty. */
  top_score: number | null
}

/** `GET /healthz` — backing-store health. */
export interface HealthResponse {
  status: string
  postgres: boolean
  redis: boolean
}

/** Error envelope from the API: every 4xx/5xx body is `{ "error": "..." }`. */
export interface ErrorBody {
  error: string
}
