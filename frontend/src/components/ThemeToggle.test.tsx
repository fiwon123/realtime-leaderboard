import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  it('cycles light → dark and applies data-theme', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: /theme:/i })
    const initial = button.getAttribute('aria-label')
    if (initial?.includes('light')) {
      await user.click(button)
      expect(button).toHaveAccessibleName(/theme: dark/i)
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(localStorage.getItem('theme')).toBe('dark')
      await user.click(button)
      expect(button).toHaveAccessibleName(/theme: light/i)
      expect(document.documentElement.dataset.theme).toBe('light')
    } else {
      await user.click(button)
      expect(button).toHaveAccessibleName(/theme: light/i)
      expect(document.documentElement.dataset.theme).toBe('light')
      expect(localStorage.getItem('theme')).toBe('light')
      await user.click(button)
      expect(button).toHaveAccessibleName(/theme: dark/i)
    }
  })

  it('defaults to dark on first visit', () => {
    render(<ThemeToggle />)

    expect(
      screen.getByRole('button', { name: /theme: dark/i }),
    ).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('starts from a persisted choice', () => {
    localStorage.setItem('theme', 'dark')
    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: /theme: dark/i })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('renders a decorative mode icon', () => {
    const { container } = render(<ThemeToggle />)
    const icon = container.querySelector('svg.theme-icon')

    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })
})
