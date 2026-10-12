import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DemoSeeder } from './DemoSeeder'

describe('DemoSeeder', () => {
  it('submits the sample players and notifies the caller', async () => {
    const onSeeded = vi.fn()
    const user = userEvent.setup()
    render(<DemoSeeder onSeeded={onSeeded} />)

    await user.click(screen.getByRole('button', { name: /seed demo players/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      /seeded 5 demo players/i,
    )
    expect(onSeeded).toHaveBeenCalledTimes(1)
  })
})
