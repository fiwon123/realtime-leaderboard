/**
 * Leaderboard paging state that round-trips through the URL query string, so a
 * page is shareable and browser Back/Forward re-syncs it.
 */

/** Allowed page sizes; the API accepts any limit up to 100. */
export const PAGE_SIZES = [10, 25, 50] as const

export type PageSize = (typeof PAGE_SIZES)[number]

export const DEFAULT_PAGE_SIZE: PageSize = 10

export interface Paging {
  offset: number
  limit: PageSize
}

function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(value)
}

/** Read `offset`/`limit` from a query string, ignoring anything invalid. */
export function parsePaging(search: string): Paging {
  const params = new URLSearchParams(search)

  const rawLimit = Number(params.get('limit'))
  const limit = isPageSize(rawLimit) ? rawLimit : DEFAULT_PAGE_SIZE

  const rawOffset = Number(params.get('offset'))
  const offset = Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0

  return { offset, limit }
}

/** Build the current path + query string for a paging state. */
export function pagingUrl(
  paging: Paging,
  location: { pathname: string; search: string } = globalThis.location,
): string {
  const params = new URLSearchParams(location.search)

  if (paging.offset > 0) {
    params.set('offset', String(paging.offset))
  } else {
    params.delete('offset')
  }

  if (paging.limit !== DEFAULT_PAGE_SIZE) {
    params.set('limit', String(paging.limit))
  } else {
    params.delete('limit')
  }

  const search = params.toString()
  return `${location.pathname}${search === '' ? '' : `?${search}`}`
}

/** The page offset that shows the page containing `rank` (1-based). */
export function offsetForRank(rank: number, limit: number): number {
  if (!Number.isFinite(rank) || rank <= 1) {
    return 0
  }
  return Math.floor((rank - 1) / limit) * limit
}
