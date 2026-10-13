import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { About } from './About'

describe('About', () => {
  it('renders the blurb and the what-you-can-do steps', () => {
    render(<About />)

    expect(
      screen.getByText(/real-time leaderboard service/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /what you can do/i }),
    ).toBeInTheDocument()

    const steps = screen.getAllByRole('listitem')
    expect(steps).toHaveLength(3)
    expect(steps[2]).toHaveTextContent(
      /page through the top of the board — or switch on live to auto-refresh it every 5 seconds/i,
    )
  })

  it('keeps each step in one element so it cannot split across flex items', () => {
    render(<About />)

    // The row is display:flex. If an inline <strong> were not wrapped in a
    // single span it would become its own flex item, pushing the tail of the
    // sentence onto a new, un-indented line. One child span prevents that.
    for (const step of screen.getAllByRole('listitem')) {
      expect(step.children).toHaveLength(1)
      expect(step.firstElementChild?.tagName).toBe('SPAN')
    }
  })

  it('exposes the anchors the nav links scroll to', () => {
    render(<About />)

    expect(document.getElementById('about-heading')).not.toBeNull()
    expect(document.getElementById('about-steps-heading')).not.toBeNull()
  })
})
