import { useCallback, useEffect, useState } from 'react'
import { ApiError, getLeaderboard } from '../api/client'
import type { LeaderboardEntry } from '../api/types'

interface LeaderboardProps {
  /** Bump to force a reload (e.g. after a score is submitted). */
  refreshKey?: number
}

const PAGE_SIZE = 10

export function Leaderboard({ refreshKey = 0 }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // No state is set before the first `await`, so the effect below only ever
  // updates state from the async continuation (not synchronously on mount).
  const load = useCallback(async () => {
    try {
      const data = await getLeaderboard(PAGE_SIZE, 0)
      setEntries(data.entries)
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
    void load()
  }, [load, refreshKey])

  function refresh() {
    setLoading(true)
    setError(null)
    void load()
  }

  return (
    <section aria-labelledby="leaderboard-heading">
      <div className="section-header">
        <h2 id="leaderboard-heading">Leaderboard</h2>
        <button type="button" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </div>

      {error !== null && <p role="alert" className="error">{error}</p>}

      {!loading && error === null && entries.length === 0 && (
        <p role="status">No scores yet.</p>
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
              <tr key={entry.player_id}>
                <td>{entry.rank}</td>
                <td>{entry.player_id}</td>
                <td>{entry.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
