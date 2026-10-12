import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ApiError, getLeaderboard } from '../api/client'
import type { LeaderboardEntry } from '../api/types'
import { PAGE_SIZES, type PageSize } from '../lib/paging'
import { LogoMark } from './Logo'
import { Skeleton } from './Skeleton'

interface LeaderboardProps {
  /** Bump to force a reload (e.g. after a score is submitted). */
  refreshKey?: number
  /** Live-mode poll interval in milliseconds; overridable for tests. */
  autoRefreshMs?: number
  /** Current page offset (rows to skip); defaults to 0. */
  offset?: number
  /** Current page size; defaults to 10. */
  limit?: PageSize
  /** Called when the user pages; defaults to internal state. */
  onOffsetChange?: (offset: number) => void
  /** Called when the user changes the page size; defaults to internal state. */
  onLimitChange?: (limit: PageSize) => void
}

const DEFAULT_AUTO_REFRESH_MS = 5000

export function Leaderboard({
  refreshKey = 0,
  autoRefreshMs = DEFAULT_AUTO_REFRESH_MS,
  offset: offsetProp,
  limit: limitProp,
  onOffsetChange,
  onLimitChange,
}: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [total, setTotal] = useState(0)
  const [internalOffset, setInternalOffset] = useState(0)
  const [internalLimit, setInternalLimit] = useState<PageSize>(10)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)

  // Controlled by the parent when it passes paging props, otherwise standalone.
  const offset = offsetProp ?? internalOffset
  const limit = limitProp ?? internalLimit
  const goToOffset = (next: number) => {
    if (onOffsetChange !== undefined) {
      onOffsetChange(next)
    } else {
      setInternalOffset(next)
    }
  }
  const setLimit = (next: PageSize) => {
    if (onLimitChange !== undefined) {
      onLimitChange(next)
    } else {
      setInternalLimit(next)
    }
  }

  // No state is set before the first `await`, so the effects below only ever
  // update state from the async continuation (not synchronously on mount).
  const load = useCallback(
    async (from: number, size: number) => {
      try {
        const data = await getLeaderboard(size, from)
        setEntries(data.entries)
        setTotal(data.total ?? 0)
        setError(null)
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not load the leaderboard.',
        )
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Fetch-on-mount/refresh: this effect synchronizes with an external system
  // (the API), and `load` only sets state after its internal `await` -- not
  // synchronously. The rule cannot see through the async boundary.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load(offset, limit)
  }, [load, offset, limit, refreshKey])

  // Live mode re-fetches the current page on an interval until toggled off.
  useEffect(() => {
    if (!live) {
      return
    }
    const id = setInterval(() => {
      void load(offset, limit)
    }, autoRefreshMs)
    return () => clearInterval(id)
  }, [live, offset, limit, load, autoRefreshMs])

  function refresh() {
    setLoading(true)
    setError(null)
    void load(offset, limit)
  }

  function goTo(next: number) {
    setLoading(true)
    goToOffset(next)
  }

  function changeSize(event: ChangeEvent<HTMLSelectElement>) {
    setLoading(true)
    setLimit(Number(event.target.value) as PageSize)
  }

  const hasPrev = offset > 0
  const hasNext = offset + limit < total
  const firstShown = entries.length === 0 ? 0 : offset + 1
  const lastShown = offset + entries.length
  // A response with rows but no `total` can only come from an API that predates
  // the field — the current backend always sends it.
  const looksStale = entries.length > 0 && total === 0

  return (
    <section
      className="panel panel-board"
      aria-labelledby="leaderboard-heading"
    >
      <div className="section-header">
        <h2 id="leaderboard-heading">Leaderboard</h2>
        <div className="section-actions">
          <label className="page-size">
            Rows
            <select value={limit} onChange={changeSize} disabled={loading}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="toggle"
            aria-pressed={live}
            onClick={() => setLive((on) => !on)}
          >
            {live ? 'Live: on' : 'Live: off'}
          </button>
          <button type="button" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error !== null && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {looksStale && (
        <p role="alert" className="error">
          The API response is missing <code>total</code> — it looks out of date.
          Restart it with <code>make dev-restart</code>.
        </p>
      )}

      {loading && entries.length === 0 && (
        <div className="skeleton-list" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div className="skeleton-row" key={row}>
              <Skeleton width="2.5rem" />
              <Skeleton width={row === 1 ? '70%' : '55%'} />
              <Skeleton width="3.5rem" />
            </div>
          ))}
        </div>
      )}

      {!loading && error === null && entries.length === 0 && total === 0 && (
        <div className="empty-state" role="status">
          <LogoMark className="empty-mark" />
          <p className="empty-title">No scores yet.</p>
          <p className="muted">Submit a score to get started.</p>
        </div>
      )}

      {/* An out-of-range offset (e.g. from a shared or stale URL) still needs a
          way back, so this keeps the pager available below. */}
      {!loading && error === null && entries.length === 0 && total > 0 && (
        <p role="status">No players on this page.</p>
      )}

      {entries.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Player</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.player_id}
                className={entry.rank === 1 ? 'leader' : undefined}
              >
                <td>
                  {entry.rank <= 3 ? (
                    <span className={`medal medal-${entry.rank}`}>
                      {entry.rank}
                    </span>
                  ) : (
                    entry.rank
                  )}
                </td>
                <td>{entry.player_id}</td>
                <td>{entry.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && error === null && (total > 0 || offset > 0) && (
        <div className="pager">
          <button
            type="button"
            onClick={() => goTo(Math.max(0, offset - limit))}
            disabled={!hasPrev || loading}
          >
            Newer
          </button>
          <span className="pager-status" role="status">
            {firstShown}–{lastShown} of {total}
          </span>
          <button
            type="button"
            onClick={() => goTo(offset + limit)}
            disabled={!hasNext || loading}
          >
            Older
          </button>
        </div>
      )}
    </section>
  )
}
