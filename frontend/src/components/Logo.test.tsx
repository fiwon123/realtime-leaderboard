import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo, LogoMark } from './Logo'

describe('Logo', () => {
  it('renders the wordmark', () => {
    render(<Logo />)
    expect(screen.getByText('Realtime Leaderboard')).toBeInTheDocument()
  })

  it('renders the mark as a decorative svg', () => {
    const { container } = render(<LogoMark />)
    const svg = container.querySelector('svg')

    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('gives each mark a unique gradient id', () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark />
      </>,
    )
    const ids = Array.from(container.querySelectorAll('linearGradient')).map(
      (node) => node.id,
    )

    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })
})
