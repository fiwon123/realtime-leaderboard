import { useCallback, useEffect, useState } from 'react'
import { ApiError, getLeaderboard } from '../api/client'
import type { LeaderboardEntry } from '../api/types'
import { Skeleton } from './Skeleton'

interface LeaderboardProps {
  /** Bump to force a reload (e.g. after a score is submitted). */
  refreshKey?: number
  /** Live-mode poll interval in milliseconds; overridable for tests. */
  autoRefreshMs?: number
}

const PAGE_SIZE = 10
const DEFAULT_AUTO_REFRESH_MS = 5000

export function Leaderboard({
  refreshKey = 0,
  autoRefreshMs = DEFAULT_AUTO_REFRESH_MS,
}: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)

  // No state is set before the first `await`, so the effects below only ever
  // update state from the async continuation (not synchronously on mount).
  const load = useCallback(async (from: number) => {
    try {
      const data = await getLeaderboard(PAGE_SIZE, from)
      setEntries(data.entries)
      setTotal(data.total ?? 0)
      setError(null)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load the leaderboard.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch-on-mount/refresh: this effect synchronizes with an external system
  // (the API), and `load` only sets state after its internal `await` -- not
  // synchronously. The rule cannot see through the async boundary.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load(offset)
  }, [load, offset, refreshKey])

  // Live mode re-fetches the current page on an interval until toggled off.
  useEffect(() => {
    if (!live) {
      return
    }
    const id = setInterval(() => {
      void load(offset)
    }, autoRefreshMs)
    return () => clearInterval(id)
  }, [live, offset, load, autoRefreshMs])

  function refresh() {
    setLoading(true)
    setError(null)
    void load(offset)
  }

  function goTo(next: number) {
    setLoading(true)
    setOffset(next)
  }

  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < total
  const firstShown = entries.length === 0 ? 0 : offset + 1
  const lastShown = offset + entries.length

  return (
    <section aria-labelledby="leaderboard-heading">
      <div className="section-header">
        <h2 id="leaderboard-heading">Leaderboard</h2>
        <div className="section-actions">
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

      {error !== null && <p role="alert" className="error">{error}</p>}

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

      {!loading && error === null && entries.length === 0 && (
        <p role="status">No scores yet.</p>
      )}

      {entries.length > 0 && (
        <>
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
                <tr key={entry.player_id}>
                  <td>{entry.rank}</td>
                  <td>{entry.player_id}</td>
                  <td>{entry.score}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pager">
            <button
              type="button"
              onClick={() => goTo(Math.max(0, offset - PAGE_SIZE))}
              disabled={!hasPrev || loading}
            >
              Newer
            </button>
            <span className="pager-status" role="status">
              {firstShown}–{lastShown} of {total}
            </span>
            <button
              type="button"
              onClick={() => goTo(offset + PAGE_SIZE)}
              disabled={!hasNext || loading}
            >
              Older
            </button>
          </div>
        </>
      )}
    </section>
  )
}
