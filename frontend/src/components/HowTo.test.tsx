import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HowTo } from './HowTo'

describe('HowTo', () => {
  it('renders the three steps', () => {
    render(<HowTo />)

    const region = screen.getByRole('region', { name: /how to use/i })
    const steps = within(region).getAllByRole('listitem')
    expect(steps).toHaveLength(3)
    expect(steps[2]).toHaveTextContent(
      /page through the top of the board — or switch on live to auto-refresh it every 5 seconds/i,
    )
  })

  it('keeps each step in one element so it cannot split across flex items', () => {
    render(<HowTo />)

    // The row is display:flex. If an inline <strong> were not wrapped in a
    // single span it would become its own flex item, pushing the tail of the
    // sentence onto a new, un-indented line. One child span prevents that.
    for (const step of screen.getAllByRole('listitem')) {
      expect(step.children).toHaveLength(1)
      expect(step.firstElementChild?.tagName).toBe('SPAN')
    }
  })

  it('expands and minimizes the panel from its title', async () => {
    const user = userEvent.setup()
    render(<HowTo />)

    const toggle = screen.getByRole('button', { name: /how to use/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('howto-body')).toHaveAttribute('hidden')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('howto-body')).not.toHaveAttribute('hidden')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})