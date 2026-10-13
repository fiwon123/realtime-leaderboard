import { useCallback, useEffect, useState } from 'react'
import { About } from './components/About'
import { AccentPicker } from './components/AccentPicker'
import { AdminPanel } from './components/AdminPanel'
import { DemoSeeder } from './components/DemoSeeder'
import { HowTo } from './components/HowTo'
import { Leaderboard } from './components/Leaderboard'
import { Logo, LogoMark } from './components/Logo'
import { RankLookup } from './components/RankLookup'
import { ScoreForm } from './components/ScoreForm'
import { StatsPanel } from './components/StatsPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { getHealth } from './api/client'
import type { HealthResponse } from './api/types'
import { offsetForRank, pagingUrl, parsePaging } from './lib/paging'
import type { PageSize, Paging } from './lib/paging'
import './App.css'

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

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  // Leaderboard paging lives here so the URL can reflect it and RankLookup can
  // drive it. It is seeded from (and kept in) the query string.
  const [paging, setPaging] = useState<Paging>(() =>
    parsePaging(window.location.search),
  )
  const bump = () => setRefreshKey((key) => key + 1)

  const commitPaging = useCallback((next: Paging) => {
    setPaging(next)
    window.history.pushState({}, '', pagingUrl(next))
  }, [])

  // Browser Back/Forward re-syncs the board without pushing a new entry.
  useEffect(() => {
    function onPopState() {
      setPaging(parsePaging(window.location.search))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Health is independent and cheap; show it in the header for at-a-glance status.
  useEffect(() => {
    let cancelled = false

    void (async () => {
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

  function goToOffset(offset: number) {
    commitPaging({ ...paging, offset: Math.max(0, offset) })
  }

  function changeLimit(limit: PageSize) {
    commitPaging({ limit, offset: 0 })
  }

  function jumpToRank(rank: number) {
    commitPaging({ ...paging, offset: offsetForRank(rank, paging.limit) })
  }

  return (
    <>
      <header className="app-header">
        <h1 className="brand">
          <Logo />
        </h1>
        <div className="header-controls">
          <HealthBadge health={health} />
          <AccentPicker />
          <ThemeToggle />
        </div>
      </header>
      <main>
        <p className="tagline">
          Submit score events and read the live ranking.
        </p>
        <HowTo />
        <About />
        <div className="panels">
          <ScoreForm onSubmitted={bump} />
          <RankLookup onJumpToRank={jumpToRank} />
          <Leaderboard
            refreshKey={refreshKey}
            offset={paging.offset}
            limit={paging.limit}
            onOffsetChange={goToOffset}
            onLimitChange={changeLimit}
          />
          <StatsPanel />
        </div>
        <div className="panels-secondary">
          <DemoSeeder onSeeded={bump} />
          <AdminPanel onChanged={bump} />
        </div>
      </main>
      <footer className="app-footer">
        <LogoMark className="footer-mark" />
        <span className="footer-note">Live rankings for every score</span>
        <nav className="footer-links" aria-label="Project links">
          <a href="/swagger-ui/">API docs</a>
          <a
            href="https://github.com/fiwon123/realtime-leaderboard"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </footer>
    </>
  )
}
