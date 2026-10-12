import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { Leaderboard } from './Leaderboard'
import { server } from '../test/mocks/server'

describe('Leaderboard', () => {
  it('renders the entries from the API, highest first', async () => {
    render(<Leaderboard />)

    const rows = await screen.findAllByRole('row')
    // header row + two data rows
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('alice')).toBeInTheDocument()
    expect(within(rows[1]).getByText('900')).toBeInTheDocument()
    expect(within(rows[2]).getByText('bob')).toBeInTheDocument()
  })

  it('shows an empty state when there are no scores', async () => {
    server.use(
      http.get('/leaderboard', () => HttpResponse.json({ entries: [] })),
    )

    render(<Leaderboard />)
    expect(await screen.findByRole('status')).toHaveTextContent(
      /no scores yet/i,
    )
  })

  it('shows an error when the API fails', async () => {
    server.use(
      http.get('/leaderboard', () =>
        HttpResponse.json({ error: 'leaderboard store failed' }, { status: 500 }),
      ),
    )

    render(<Leaderboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /leaderboard store failed/i,
    )
  })

  it('pages forward and back using the total from the API', async () => {
    server.use(
      http.get('/leaderboard', ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get('offset') ?? '0',
        )
        const entries =
          offset === 0
            ? [
                { rank: 1, player_id: 'alice', score: 900 },
                { rank: 2, player_id: 'bob', score: 700 },
              ]
            : [{ rank: 11, player_id: 'carol', score: 100 }]
        return HttpResponse.json({ entries, total: 11 })
      }),
    )

    const user = userEvent.setup()
    render(<Leaderboard />)
    expect(await screen.findByText('alice')).toBeInTheDocument()

    // total 11 with a page size of 10 makes the next page reachable.
    await user.click(screen.getByRole('button', { name: /older/i }))
    expect(await screen.findByText('carol')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /newer/i }))
    expect(await screen.findByText('alice')).toBeInTheDocument()
  })

  it('re-fetches on an interval while live is on', async () => {
    let calls = 0
    server.use(
      http.get('/leaderboard', () => {
        calls += 1
        return HttpResponse.json({ entries: [], total: 0 })
      }),
    )

    const user = userEvent.setup()
    // A short interval keeps the test fast without waiting the real 5s.
    render(<Leaderboard autoRefreshMs={20} />)
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(1))

    await user.click(screen.getByRole('button', { name: /live: off/i }))
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(2), {
      timeout: 2000,
    })

    // Turning live off stops the polling.
    await user.click(screen.getByRole('button', { name: /live: on/i }))
    const settled = calls
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(calls).toBe(settled)
  })
})
