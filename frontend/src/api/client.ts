import type {
  LeaderboardResponse,
  RankResponse,
  ScoreEvent,
  ScoreEventResponse,
} from './types'

// Empty by default: requests go to the same origin, which the Vite dev server
// proxies to the API (see vite.config.ts), so there is no cross-origin traffic
// and the backend needs no CORS layer. Point at an absolute API with
// `VITE_API_BASE_URL` when building for a different host.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

/** A failed API call: `status` is the HTTP status, `message` the server's error. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function resolveUrl(path: string): string {
  if (API_BASE_URL !== '') {
    return `${API_BASE_URL}${path}`
  }
  // Absolute URL against the current origin. `fetch` needs an absolute URL under
  // Node (the test environment); in the browser this is equivalent to `path`.
  return new URL(path, globalThis.location.origin).toString()
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Partial<{ error: string }>
    if (typeof body.error === 'string' && body.error !== '') {
      return body.error
    }
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return `request failed with status ${response.status}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(resolveUrl(path), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(0, 'Could not reach the API. Is the backend running?')
  }

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response))
  }
  return (await response.json()) as T
}

/** `POST /scores` — 201 on a new event, 200 on an idempotent replay. */
export function submitScore(event: ScoreEvent): Promise<ScoreEventResponse> {
  return request<ScoreEventResponse>('/scores', {
    method: 'POST',
    body: JSON.stringify(event),
  })
}

/** `GET /players/{player_id}/rank` — rejects with `ApiError` (404) when unknown. */
export function getRank(playerId: string): Promise<RankResponse> {
  return request<RankResponse>(`/players/${encodeURIComponent(playerId)}/rank`)
}

/** `GET /leaderboard` — a page of the board, highest score first. */
export function getLeaderboard(
  limit = 10,
  offset = 0,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  return request<LeaderboardResponse>(`/leaderboard?${params.toString()}`)
}
