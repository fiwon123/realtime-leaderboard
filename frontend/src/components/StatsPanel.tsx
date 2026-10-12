import { useEffect, useState } from 'react'
import { ApiError, getStats } from '../api/client'
import type { StatsResponse } from '../api/types'

/** Board size and peak score. */
export function StatsPanel() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const data = await getStats()
        if (!cancelled) {
          setStats(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : 'Could not load board stats.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="panel panel-stats" aria-labelledby="stats-heading">
      <div className="section-header">
        <h2 id="stats-heading">Board stats</h2>
      </div>

      {error !== null && <p role="alert" className="error">{error}</p>}

      <dl className="stats">
        <div>
          <dt>Players</dt>
          <dd>{stats === null ? '—' : stats.players}</dd>
        </div>
        <div>
          <dt>Top score</dt>
          <dd>{stats === null ? '—' : (stats.top_score ?? '—')}</dd>
        </div>
      </dl>
    </section>
  )
}
