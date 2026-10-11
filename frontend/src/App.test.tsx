import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

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
  })
})
