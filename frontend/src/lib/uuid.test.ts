import { afterEach, describe, expect, it, vi } from 'vitest'
import { newEventId } from './uuid'

describe('newEventId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns an RFC 4122 version 4 UUID', () => {
    expect(newEventId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('returns a different id on each call', () => {
    expect(newEventId()).not.toBe(newEventId())
  })

  it('throws a descriptive error when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined)
    expect(() => newEventId()).toThrow(/Web Crypto is not available/)
  })
})
