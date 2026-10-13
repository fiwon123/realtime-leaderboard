import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from './App'
import { server } from './test/mocks/server'

describe('App', () => {
  it('renders the three flows', async () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /realtime leaderboard/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /submit a score/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /player rank/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /^leaderboard$/i }),
    ).toBeInTheDocument()

    // The board loads its data on mount.
    expect(await screen.findByText('alice')).toBeInTheDocument()
  })

  it('refreshes the board after a score is submitted', async () => {
    // First load returns alice; the reload triggered by the submit returns
    // carol on top, so seeing carol proves the board actually re-fetched.
    let calls = 0
    server.use(
      http.get('/leaderboard', () => {
        calls += 1
        const entries =
          calls === 1
            ? [{ rank: 1, player_id: 'alice', score: 900 }]
            : [
                { rank: 1, player_id: 'carol', score: 950 },
                { rank: 2, player_id: 'alice', score: 900 },
              ]
        return HttpResponse.json({ entries })
      }),
    )

    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('alice')

    // Both panels label an input "Player", so scope the query to the form.
    const scorePanel = screen.getByRole('region', { name: /submit a score/i })
    await user.type(within(scorePanel).getByLabelText('Player'), 'carol')
    await user.type(within(scorePanel).getByLabelText('Score'), '950')
    await user.click(
      within(scorePanel).getByRole('button', { name: /submit score/i }),
    )

    expect(
      await screen.findByText(/stored 950 for carol/i),
    ).toBeInTheDocument()

    const leaderboard = screen.getByRole('region', { name: /^leaderboard$/i })
    expect(await within(leaderboard).findByText('carol')).toBeInTheDocument()
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it('restores the leaderboard page from the URL', async () => {
    let request: URL | null = null
    server.use(
      http.get('/leaderboard', ({ request: req }) => {
        request = new URL(req.url)
        return HttpResponse.json({
          entries: [{ rank: 11, player_id: 'zed', score: 5 }],
          total: 11,
        })
      }),
    )
    window.history.replaceState({}, '', '/?offset=10&limit=25')

    render(<App />)

    expect(await screen.findByText('zed')).toBeInTheDocument()
    expect(request!.searchParams.get('offset')).toBe('10')
    expect(request!.searchParams.get('limit')).toBe('25')
    expect(screen.getByLabelText('Rows')).toHaveValue('25')
  })

  it('syncs paging into the URL when the user pages', async () => {
    server.use(
      http.get('/leaderboard', ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get('offset') ?? '0',
        )
        const entries =
          offset === 0
            ? [{ rank: 1, player_id: 'alice', score: 900 }]
            : [{ rank: 11, player_id: 'zed', score: 1 }]
        return HttpResponse.json({ entries, total: 11 })
      }),
    )

    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: /older/i }))
    await screen.findByText('zed')

    expect(window.location.search).toBe('?offset=10')
  })

  it('pages the board to a player looked up by rank', async () => {
    server.use(
      http.get('/leaderboard', ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get('offset') ?? '0',
        )
        const entries =
          offset === 0
            ? [{ rank: 1, player_id: 'alice', score: 900 }]
            : [{ rank: 11, player_id: 'zed', score: 1 }]
        return HttpResponse.json({ entries, total: 11 })
      }),
      http.get('/players/:playerId/rank', () =>
        HttpResponse.json({ player_id: 'zed', rank: 11, score: 1 }),
      ),
    )

    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('alice')

    const rankPanel = screen.getByRole('region', { name: /player rank/i })
    await user.type(within(rankPanel).getByLabelText('Player'), 'zed')
    await user.click(
      within(rankPanel).getByRole('button', { name: /look up rank/i }),
    )
    await within(rankPanel).findByText(/is rank 11/i)

    await user.click(
      within(rankPanel).getByRole('button', { name: /show on leaderboard/i }),
    )

    expect(await screen.findByText('zed')).toBeInTheDocument()
    expect(window.location.search).toBe('?offset=10')
  })

  it('shows a healthy badge in the header', async () => {
    render(<App />)
    expect(await screen.findByText(/healthy/i)).toBeInTheDocument()
  })

  it('targets the how-to steps from the How to link', async () => {
    const user = userEvent.setup()
    render(<App />)

    // The steps live in the always-visible About band at the top of the page.
    expect(
      screen.getByRole('heading', { name: /what you can do/i }),
    ).toBeInTheDocument()

    // Two "How to" links exist (header + footer); either scrolls to the steps.
    const howTo = screen.getAllByRole('button', { name: /how to/i })
    expect(howTo).toHaveLength(2)

    await user.click(howTo[0])
    expect(document.getElementById('about-steps-heading')).not.toBeNull()
  })

  it('keeps About visible and scrolls to it from the About link', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Always visible — there is no Hide/Learn more toggle anymore.
    const aboutRegion = screen.getByRole('region', {
      name: /about this project/i,
    })
    expect(
      within(aboutRegion).getByText(/real-time leaderboard service/i),
    ).toBeInTheDocument()
    expect(within(aboutRegion).queryByRole('button')).not.toBeInTheDocument()

    // Two "About" links exist (header + footer); either scrolls to it.
    const about = screen.getAllByRole('button', { name: /^about$/i })
    expect(about).toHaveLength(2)

    await user.click(about[0])
    expect(document.getElementById('about-heading')).not.toBeNull()
  })
})
