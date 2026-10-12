import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tutorial } from './Tutorial'

describe('Tutorial', () => {
  it('renders the steps and can be dismissed', async () => {
    const user = userEvent.setup()
    render(<Tutorial />)

    expect(
      screen.getByRole('heading', { name: /how it works/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /got it/i }))

    expect(
      screen.queryByRole('heading', { name: /how it works/i }),
    ).toBeNull()
    expect(localStorage.getItem('tutorial-dismissed')).toBe('true')
  })

  it('stays dismissed when previously dismissed', () => {
    localStorage.setItem('tutorial-dismissed', 'true')
    render(<Tutorial />)

    expect(
      screen.queryByRole('heading', { name: /how it works/i }),
    ).toBeNull()
  })
})
