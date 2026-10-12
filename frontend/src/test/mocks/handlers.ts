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
export const handlers = [
  http.post('/scores', async ({ request }) => {
    const body = (await request.json()) as ScoreEvent
    return HttpResponse.json({ ...body, duplicate: false }, { status: 201 })
  }),

  http.get('/players', ({ request }) => {
    const prefix = new URL(request.url).searchParams.get('prefix') ?? ''
    const players = ['alice', 'al', 'bob'].filter((player) =>
      player.toLowerCase().startsWith(prefix.toLowerCase()),
    )
    return HttpResponse.json({ players })
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
