import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  offsetForRank,
  pagingUrl,
  parsePaging,
} from './paging'
import type { Paging } from './paging'

describe('parsePaging', () => {
  it('defaults to page one with the default size', () => {
    expect(parsePaging('')).toEqual({ offset: 0, limit: DEFAULT_PAGE_SIZE })
  })

  it('reads valid offset and limit', () => {
    expect(parsePaging('?offset=20&limit=25')).toEqual({ offset: 20, limit: 25 })
  })

  it('ignores an unsupported limit', () => {
    expect(parsePaging('?limit=999').limit).toBe(DEFAULT_PAGE_SIZE)
  })

  it('ignores a negative or non-integer offset', () => {
    expect(parsePaging('?offset=-5').offset).toBe(0)
    expect(parsePaging('?offset=abc').offset).toBe(0)
  })
})

describe('pagingUrl', () => {
  const location = { pathname: '/', search: '' }

  it('omits defaults from the query string', () => {
    expect(pagingUrl({ offset: 0, limit: DEFAULT_PAGE_SIZE }, location)).toBe('/')
  })

  it('writes non-default values', () => {
    expect(pagingUrl({ offset: 20, limit: 25 }, location)).toBe(
      '/?offset=20&limit=25',
    )
  })

  it('preserves unrelated query params', () => {
    expect(
      pagingUrl({ offset: 10, limit: DEFAULT_PAGE_SIZE }, {
        pathname: '/',
        search: '?ref=abc',
      }),
    ).toBe('/?ref=abc&offset=10')
  })

  it('round-trips through parsePaging', () => {
    const paging: Paging = { offset: 50, limit: 50 }
    const url = pagingUrl(paging, location)
    expect(parsePaging(url.slice(url.indexOf('?')))).toEqual(paging)
  })
})

describe('offsetForRank', () => {
  it('returns page one for the first page of ranks', () => {
    expect(offsetForRank(1, 10)).toBe(0)
    expect(offsetForRank(10, 10)).toBe(0)
  })

  it('maps a rank to the page that contains it', () => {
    expect(offsetForRank(11, 10)).toBe(10)
    expect(offsetForRank(26, 25)).toBe(25)
  })

  it('treats invalid ranks as page one', () => {
    expect(offsetForRank(0, 10)).toBe(0)
    expect(offsetForRank(Number.NaN, 10)).toBe(0)
  })
})
