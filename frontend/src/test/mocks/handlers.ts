import { http, HttpResponse } from 'msw'
import type { ScoreEvent } from '../../api/types'

const ENTRIES = [
  { rank: 1, player_id: 'alice', score: 900 },
  { rank: 2, player_id: 'bob', score: 700 },
]

/**
 * Default MSW handlers for the API contract in `backend/openapi.json`. Relative
 * paths resolve against the test origin, so they are origin-agnostic. Individual
 * tests override these with `server.use(...)`.
 */

/** Known players the `/players` mock searches, mirroring the API ordering. */
const SEARCHABLE = ['alice', 'al', 'bob']

/** Exact match, then prefix, then substring — the backend's ranking. */
function rankPlayers(term: string): string[] {
  const query = term.toLowerCase()
  const bucket = (id: string) => {
    const lower = id.toLowerCase()
    if (lower === query) return 0
    return lower.startsWith(query) ? 1 : 2
  }
  return SEARCHABLE.filter((id) => id.toLowerCase().includes(query)).sort(
    (a, b) =>
      bucket(a) - bucket(b) ||
      a.toLowerCase().indexOf(query) - b.toLowerCase().indexOf(query) ||
      a.length - b.length ||
      a.localeCompare(b),
  )
}

export const handlers = [
  http.post('/scores', async ({ request }) => {
    const body = (await request.json()) as ScoreEvent
    return HttpResponse.json({ ...body, duplicate: false }, { status: 201 })
  }),

  http.get('/players', ({ request }) => {
    const params = new URL(request.url).searchParams
    const prefix = (params.get('prefix') ?? '').trim()
    const limit = Number(params.get('limit') ?? 5)
    return HttpResponse.json({ players: rankPlayers(prefix).slice(0, limit) })
  }),

  http.get('/players/:playerId/rank', ({ params }) => {
    const playerId = String(params.playerId)
    if (playerId === 'nobody') {
      return HttpResponse.json({ error: 'resource not found' }, { status: 404 })
    }
    return HttpResponse.json({ player_id: playerId, rank: 1, score: 900 })
  }),

  http.get('/leaderboard', () => HttpResponse.json({ entries: ENTRIES, total: 2 })),

  http.get('/stats', () =>
    HttpResponse.json({ players: 2, top_score: 900 }),
  ),

  http.get('/healthz', () =>
    HttpResponse.json({ status: 'ok', postgres: true, redis: true }),
  ),

  // Admin routes are destructive; tests override these to assert behavior.
  http.delete('/players/:playerId', () => new HttpResponse(null, { status: 204 })),
  http.delete('/scores', () => new HttpResponse(null, { status: 204 })),
]
