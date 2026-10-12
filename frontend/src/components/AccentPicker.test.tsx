import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AccentPicker } from './AccentPicker'

describe('AccentPicker', () => {
  it('marks indigo as the default selection', () => {
    render(<AccentPicker />)

    expect(screen.getByRole('group', { name: /accent colour/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /accent: indigo/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /accent: amber/i }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.dataset.accent).toBeUndefined()
  })

  it('applies and persists a chosen accent', async () => {
    const user = userEvent.setup()
    render(<AccentPicker />)

    await user.click(screen.getByRole('button', { name: /accent: amber/i }))

    expect(document.documentElement.dataset.accent).toBe('amber')
    expect(localStorage.getItem('accent')).toBe('amber')
    expect(
      screen.getByRole('button', { name: /accent: amber/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('clears the override when the default accent is chosen again', async () => {
    localStorage.setItem('accent', 'amber')
    const user = userEvent.setup()
    render(<AccentPicker />)

    await user.click(screen.getByRole('button', { name: /accent: indigo/i }))

    expect(document.documentElement.dataset.accent).toBeUndefined()
    expect(localStorage.getItem('accent')).toBeNull()
  })

  it('starts from a persisted accent', () => {
    localStorage.setItem('accent', 'rose')
    render(<AccentPicker />)

    expect(document.documentElement.dataset.accent).toBe('rose')
    expect(
      screen.getByRole('button', { name: /accent: rose/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
