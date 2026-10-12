import { describe, expect, it } from 'vitest'
import { formatRelative } from './time'

const AT = 1_700_000_000_000

describe('formatRelative', () => {
  it('reads as "just now" within the first few seconds', () => {
    expect(formatRelative(AT, AT)).toBe('just now')
    expect(formatRelative(AT + 4_000, AT)).toBe('just now')
  })

  it('counts seconds under a minute', () => {
    expect(formatRelative(AT + 5_000, AT)).toBe('5s ago')
    expect(formatRelative(AT + 59_000, AT)).toBe('59s ago')
  })

  it('counts minutes under an hour', () => {
    expect(formatRelative(AT + 60_000, AT)).toBe('1m ago')
    expect(formatRelative(AT + 59 * 60_000, AT)).toBe('59m ago')
  })

  it('counts hours under a day', () => {
    expect(formatRelative(AT + 60 * 60_000, AT)).toBe('1h ago')
    expect(formatRelative(AT + 23 * 60 * 60_000, AT)).toBe('23h ago')
  })

  it('counts days beyond that', () => {
    expect(formatRelative(AT + 24 * 60 * 60_000, AT)).toBe('1d ago')
  })

  it('clamps a future timestamp to "just now"', () => {
    expect(formatRelative(AT, AT + 10_000)).toBe('just now')
  })
})
