import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { About } from './About'

describe('About', () => {
  it('reveals content and can trigger tutorial re-show', async () => {
    const onShow = vi.fn()
    const user = userEvent.setup()
    render(<About showTutorialAgain={onShow} />)

    const toggle = screen.getByRole('button', { name: /learn more/i })
    expect(screen.queryByText(/real-time leaderboard/i)).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByText(/real-time leaderboard/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show tutorial again/i }))
    expect(onShow).toHaveBeenCalledTimes(1)
  })
})
