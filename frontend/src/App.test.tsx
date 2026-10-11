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
})
