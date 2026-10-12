import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RankLookup } from './RankLookup'

describe('RankLookup', () => {
  it('shows the rank for a known player', async () => {
    const user = userEvent.setup()
    render(<RankLookup />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.click(screen.getByRole('button', { name: /look up rank/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      /alice is rank 1 with 900/i,
    )
  })

  it('reports when a player has no standing yet', async () => {
    const user = userEvent.setup()
    render(<RankLookup />)

    await user.type(screen.getByLabelText('Player'), 'nobody')
    await user.click(screen.getByRole('button', { name: /look up rank/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      /no standing yet/i,
    )
  })

  it('requires a player id', async () => {
    const user = userEvent.setup()
    render(<RankLookup />)

    await user.click(screen.getByRole('button', { name: /look up rank/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /enter a player id/i,
    )
  })

  it('offers to show the looked-up rank on the leaderboard', async () => {
    const onJumpToRank = vi.fn()
    const user = userEvent.setup()
    render(<RankLookup onJumpToRank={onJumpToRank} />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.click(screen.getByRole('button', { name: /look up rank/i }))
    await screen.findByRole('status')

    await user.click(
      screen.getByRole('button', { name: /show on leaderboard/i }),
    )
    expect(onJumpToRank).toHaveBeenCalledWith(1)
  })

  it('hides the jump action when no handler is provided', async () => {
    const user = userEvent.setup()
    render(<RankLookup />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.click(screen.getByRole('button', { name: /look up rank/i }))
    await screen.findByRole('status')

    expect(
      screen.queryByRole('button', { name: /show on leaderboard/i }),
    ).toBeNull()
  })
})
