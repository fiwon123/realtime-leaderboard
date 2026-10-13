import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { About } from './About'

describe('About', () => {
  it('renders the blurb', () => {
    render(<About />)

    expect(
      screen.getByText(/real-time leaderboard service/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /about this project/i }),
    ).toBeInTheDocument()
  })

  it('expands and minimizes the panel from its title', async () => {
    const user = userEvent.setup()
    render(<About />)

    const region = screen.getByRole('region', { name: /about this project/i })
    const toggle = within(region).getByRole('button', {
      name: /about this project/i,
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('about-body')).toHaveAttribute('hidden')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('about-body')).not.toHaveAttribute('hidden')
  })

  it('restores a minimized panel from localStorage', () => {
    localStorage.setItem('panel:about:open', 'false')

    render(<About />)

    expect(
      screen.getByRole('button', { name: /about this project/i }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('about-body')).toHaveAttribute('hidden')
  })
})