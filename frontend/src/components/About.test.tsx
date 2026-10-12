import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { About } from './About'

describe('About', () => {
  it('starts open and can be collapsed', async () => {
    const user = userEvent.setup()
    render(<About />)

    expect(screen.getByText(/real-time leaderboard service/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /hide/i }))
    expect(
      screen.queryByText(/real-time leaderboard service/i),
    ).not.toBeInTheDocument()
  })

  it('can trigger the tutorial re-show', async () => {
    const onShow = vi.fn()
    const user = userEvent.setup()
    render(<About showTutorialAgain={onShow} />)

    await user.click(
      screen.getByRole('button', { name: /show tutorial again/i }),
    )
    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('honours a controlled open state', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<About open={false} onOpenChange={onOpenChange} />)

    expect(
      screen.queryByText(/real-time leaderboard service/i),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /learn more/i }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    // The parent did not update, so the content stays hidden.
    expect(
      screen.queryByText(/real-time leaderboard service/i),
    ).not.toBeInTheDocument()
  })
})
