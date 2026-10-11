import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ApiError, getLeaderboard, getRank, submitScore } from './client'
import { server } from '../test/mocks/server'

describe('submitScore', () => {
  it('posts the event and returns the parsed response', async () => {
    let received: Record<string, unknown> | undefined
    server.use(
      http.post('/scores', async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...received, duplicate: false }, { status: 201 })
      }),
    )

    const response = await submitScore({
      event_id: 'e1',
      player_id: 'alice',
      score: 10,
    })

    expect(received).toEqual({ event_id: 'e1', player_id: 'alice', score: 10 })
    expect(response.duplicate).toBe(false)
  })

  it('surfaces the API error message on 400', async () => {
    server.use(
      http.post('/scores', () =>
        HttpResponse.json(
          { error: 'bad request: score outside range' },
          { status: 400 },
        ),
      ),
    )

    await expect(
      submitScore({ event_id: 'e1', player_id: 'alice', score: 1 }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'bad request: score outside range',
    })
  })
})

describe('getRank', () => {
  it('returns the standing', async () => {
    await expect(getRank('alice')).resolves.toEqual({
      player_id: 'alice',
      rank: 1,
      score: 900,
    })
  })

  it('throws ApiError 404 for an unknown player', async () => {
    const error = await getRank('nobody').catch((err: unknown) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404 })
  })

  it('percent-encodes the player id', async () => {
    let seen = ''
    server.use(
      http.get('/players/:playerId/rank', ({ params }) => {
        seen = String(params.playerId)
        return HttpResponse.json({ player_id: seen, rank: 1, score: 1 })
      }),
    )

    await getRank('a b/c')
    expect(seen).toBe('a b/c')
  })
})

describe('getLeaderboard', () => {
  it('sends limit and offset as query params', async () => {
    let limit: string | null = null
    let offset: string | null = null
    server.use(
      http.get('/leaderboard', ({ request }) => {
        const url = new URL(request.url)
        limit = url.searchParams.get('limit')
        offset = url.searchParams.get('offset')
        return HttpResponse.json({ entries: [] })
      }),
    )

    await getLeaderboard(25, 50)

    expect(limit).toBe('25')
    expect(offset).toBe('50')
  })

  it('defaults to limit 10 and offset 0', async () => {
    let limit: string | null = null
    server.use(
      http.get('/leaderboard', ({ request }) => {
        limit = new URL(request.url).searchParams.get('limit')
        return HttpResponse.json({ entries: [] })
      }),
    )

    await getLeaderboard()
    expect(limit).toBe('10')
  })
})
