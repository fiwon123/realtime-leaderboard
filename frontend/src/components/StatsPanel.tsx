import { useEffect, useState } from 'react'
import { ApiError, getHealth, getStats } from '../api/client'
import type { HealthResponse, StatsResponse } from '../api/types'

function HealthBadge({ health }: { health: HealthResponse | null }) {
  const ok = health?.status === 'ok'
  const label = health === null ? 'Checking…' : ok ? 'Healthy' : 'Degraded'

  return (
    <span
      className={ok ? 'badge ok' : 'badge bad'}
      role="status"
      title={
        health === null
          ? 'Checking the API health'
          : `postgres=${health.postgres} redis=${health.redis}`
      }
    >
      <span className="badge-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

/** Board size, peak score, and a live health badge. */
export function StatsPanel() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
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

      // Health is independent: a degraded store must not hide the stats.
      try {
        const data = await getHealth()
        if (!cancelled) {
          setHealth(data)
        }
      } catch {
        if (!cancelled) {
          setHealth({ status: 'degraded', postgres: false, redis: false })
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
        <HealthBadge health={health} />
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
