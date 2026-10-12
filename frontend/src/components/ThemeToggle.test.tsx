import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  it('cycles system → light → dark and applies data-theme', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: /theme:/i })
    expect(button).toHaveTextContent('system')

    await user.click(button)
    expect(button).toHaveTextContent('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')

    await user.click(button)
    expect(button).toHaveTextContent('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(button)
    expect(button).toHaveTextContent('system')
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('starts from a persisted choice', () => {
    localStorage.setItem('theme', 'dark')
    render(<ThemeToggle />)

    expect(
      screen.getByRole('button', { name: /theme:/i }),
    ).toHaveTextContent('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
