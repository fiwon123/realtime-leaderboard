import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { Leaderboard } from './Leaderboard'
import { server } from '../test/mocks/server'

const ENTRIES = [
  { rank: 1, player_id: 'alice', score: 900 },
  { rank: 2, player_id: 'bob', score: 700 },
]

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
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('carol')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /previous/i }))
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

    await user.click(screen.getByRole('button', { name: /auto-refresh: off/i }))
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(2), {
      timeout: 2000,
    })

    // Turning live off stops the polling.
    await user.click(screen.getByRole('button', { name: /auto-refresh: on/i }))
    const settled = calls
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(calls).toBe(settled)
  })

  it('shows medals for the top three and highlights the leader', async () => {
    server.use(
      http.get('/leaderboard', () =>
        HttpResponse.json({
          entries: [
            { rank: 1, player_id: 'alice', score: 900 },
            { rank: 2, player_id: 'bob', score: 700 },
            { rank: 3, player_id: 'carol', score: 500 },
            { rank: 4, player_id: 'dave', score: 400 },
          ],
          total: 4,
        }),
      ),
    )

    const { container } = render(<Leaderboard />)
    await screen.findByText('alice')

    expect(container.querySelector('.medal-1')).toHaveTextContent('1')
    expect(container.querySelector('.medal-2')).toHaveTextContent('2')
    expect(container.querySelector('.medal-3')).toHaveTextContent('3')
    // Rank 4 is a plain number, not a medal.
    expect(container.querySelector('.medal-4')).toBeNull()
    expect(container.querySelector('tr.leader')).toHaveTextContent('alice')
  })

  it('shows the trophy mark in the empty state', async () => {
    server.use(
      http.get('/leaderboard', () => HttpResponse.json({ entries: [], total: 0 })),
    )

    render(<Leaderboard />)
    const status = await screen.findByRole('status')

    expect(status).toHaveTextContent(/no scores yet/i)
    expect(status.querySelector('svg')).not.toBeNull()
  })

  it('requests the chosen page size', async () => {
    let requestedLimit: string | null = null
    server.use(
      http.get('/leaderboard', ({ request }) => {
        requestedLimit = new URL(request.url).searchParams.get('limit')
        return HttpResponse.json({ entries: ENTRIES, total: 2 })
      }),
    )

    const user = userEvent.setup()
    render(<Leaderboard />)
    await screen.findByText('alice')

    await user.selectOptions(screen.getByLabelText('Rows'), '25')
    await waitFor(() => expect(requestedLimit).toBe('25'))
  })

  it('warns when the response has rows but no total (stale API)', async () => {
    server.use(
      http.get('/leaderboard', () =>
        HttpResponse.json({ entries: ENTRIES }),
      ),
    )

    render(<Leaderboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /out of date/i,
    )
  })

  it('lets you page back from an out-of-range page', async () => {
    const onOffsetChange = vi.fn()
    server.use(
      http.get('/leaderboard', () =>
        HttpResponse.json({ entries: [], total: 11 }),
      ),
    )

    const user = userEvent.setup()
    render(
      <Leaderboard offset={20} limit={10} onOffsetChange={onOffsetChange} />,
    )

    expect(
      await screen.findByText(/no players on this page/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(onOffsetChange).toHaveBeenCalledWith(10)
  })

  it('reports paging changes to the parent when controlled', async () => {
    const onOffsetChange = vi.fn()
    server.use(
      http.get('/leaderboard', ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get('offset') ?? '0',
        )
        const entries =
          offset === 0 ? [{ rank: 1, player_id: 'alice', score: 900 }] : []
        return HttpResponse.json({ entries, total: 11 })
      }),
    )

    const user = userEvent.setup()
    render(
      <Leaderboard offset={0} limit={10} onOffsetChange={onOffsetChange} />,
    )
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(onOffsetChange).toHaveBeenCalledWith(10)
  })

  it('stamps when the board was last updated', async () => {
    render(<Leaderboard />)

    await screen.findByText('alice')
    expect(await screen.findByText(/updated just now/i)).toBeInTheDocument()
  })

  it('shows rank movement after a refresh on the same page', async () => {
    let load = 0
    server.use(
      http.get('/leaderboard', () => {
        load += 1
        const entries =
          load === 1
            ? [
                { rank: 1, player_id: 'alice', score: 900 },
                { rank: 2, player_id: 'bob', score: 700 },
              ]
            : [
                { rank: 1, player_id: 'bob', score: 700 },
                { rank: 2, player_id: 'alice', score: 900 },
              ]
        return HttpResponse.json({ entries, total: 2 })
      }),
    )

    const user = userEvent.setup()
    render(<Leaderboard />)
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: /^refresh$/i }))

    // alice fell 1→2, bob rose 2→1.
    expect(await screen.findByText('down 1')).toBeInTheDocument()
    expect(screen.getByText('up 1')).toBeInTheDocument()
  })

  it('does not show movement after paging to a different page', async () => {
    server.use(
      http.get('/leaderboard', ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get('offset') ?? '0',
        )
        const entries =
          offset === 0
            ? [{ rank: 1, player_id: 'alice', score: 900 }]
            : [{ rank: 11, player_id: 'carol', score: 100 }]
        return HttpResponse.json({ entries, total: 11 })
      }),
    )

    const user = userEvent.setup()
    const { container } = render(<Leaderboard />)
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText('carol')

    expect(container.querySelectorAll('.movement')).toHaveLength(0)
  })

  it('highlights a row whose score changed even when the rank did not move', async () => {
    let load = 0
    server.use(
      http.get('/leaderboard', () => {
        load += 1
        const entries =
          load === 1
            ? [{ rank: 1, player_id: 'alice', score: 900 }]
            : [{ rank: 1, player_id: 'alice', score: 1000 }]
        return HttpResponse.json({ entries, total: 1 })
      }),
    )

    const user = userEvent.setup()
    const { container } = render(<Leaderboard />)
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: /^refresh$/i }))

    await waitFor(() => {
      expect(container.querySelectorAll('tr.changed')).toHaveLength(1)
    })
    expect(container.querySelector('tr.changed')).toHaveTextContent('alice')
    // The rank did not move, so no arrow is shown.
    expect(container.querySelectorAll('.movement')).toHaveLength(0)
  })

  it('highlights a player that newly appears on the page', async () => {
    let load = 0
    server.use(
      http.get('/leaderboard', () => {
        load += 1
        const entries =
          load === 1
            ? [{ rank: 1, player_id: 'alice', score: 900 }]
            : [
                { rank: 1, player_id: 'alice', score: 900 },
                { rank: 2, player_id: 'bob', score: 700 },
              ]
        return HttpResponse.json({ entries, total: 2 })
      }),
    )

    const user = userEvent.setup()
    const { container } = render(<Leaderboard />)
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: /^refresh$/i }))
    await screen.findByText('bob')

    await waitFor(() => {
      expect(container.querySelectorAll('tr.changed')).toHaveLength(1)
    })
    expect(container.querySelector('tr.changed')).toHaveTextContent('bob')
  })

  it('clears the highlight once a load reports no change', async () => {
    let load = 0
    server.use(
      http.get('/leaderboard', () => {
        load += 1
        const score = load === 1 ? 900 : 1000
        return HttpResponse.json({
          entries: [{ rank: 1, player_id: 'alice', score }],
          total: 1,
        })
      }),
    )

    const user = userEvent.setup()
    const { container } = render(<Leaderboard />)
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: /^refresh$/i }))
    await waitFor(() => {
      expect(container.querySelectorAll('tr.changed')).toHaveLength(1)
    })

    // Third load: same score as the second, so nothing changed.
    await user.click(screen.getByRole('button', { name: /^refresh$/i }))
    await waitFor(() => {
      expect(container.querySelectorAll('tr.changed')).toHaveLength(0)
    })
  })

  it('pins the movement arrow inside the rank cell', async () => {
    let load = 0
    server.use(
      http.get('/leaderboard', () => {
        load += 1
        const entries =
          load === 1
            ? [
                { rank: 1, player_id: 'alice', score: 900 },
                { rank: 2, player_id: 'bob', score: 700 },
              ]
            : [
                { rank: 1, player_id: 'bob', score: 700 },
                { rank: 2, player_id: 'alice', score: 900 },
              ]
        return HttpResponse.json({ entries, total: 2 })
      }),
    )

    const user = userEvent.setup()
    const { container } = render(<Leaderboard />)
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: /^refresh$/i }))
    await screen.findByText('up 1')

    const rankCell = container.querySelector('.rank-cell')
    expect(rankCell).not.toBeNull()
    // The number and the arrow share the rank cell, so the arrow never shifts
    // the centered number into a neighbouring column.
    expect(rankCell?.querySelector('.movement')).not.toBeNull()
    expect(rankCell?.textContent).toContain('1')
    expect(rankCell?.parentElement?.tagName).toBe('TD')
  })
})
