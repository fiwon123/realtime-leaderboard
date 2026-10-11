import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
})
