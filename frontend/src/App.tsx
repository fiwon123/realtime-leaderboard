import { useCallback, useEffect, useState } from 'react'
import { About } from './components/About'
import { AccentPicker } from './components/AccentPicker'
import { AdminPanel } from './components/AdminPanel'
import { DemoSeeder } from './components/DemoSeeder'
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

/** Small book glyph marking the "How to" nav control. */
function HowToIcon() {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4.5h6.5a3.5 3.5 0 0 1 3.5 3.5v11a2.5 2.5 0 0 0-2.5-2.5H2z" />
      <path d="M22 4.5h-6.5A3.5 3.5 0 0 0 12 8v11a2.5 2.5 0 0 1 2.5-2.5H22z" />
    </svg>
  )
}

/** Small info glyph marking the "About" nav control. */
function AboutIcon() {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.75h.01" />
    </svg>
  )
}

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

  // Scroll the shared how-to steps into view from a nav link.
  function scrollToHowTo() {
    const heading = document.getElementById('about-steps-heading')
    if (typeof heading?.scrollIntoView === 'function') {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Scroll the About band into view from a nav link. It is always visible, so
  // there is nothing to reveal.
  function scrollToAbout() {
    const heading = document.getElementById('about-heading')
    if (typeof heading?.scrollIntoView === 'function') {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <>
      <header className="app-header">
        <h1 className="brand">
          <Logo />
        </h1>
        <nav className="header-nav" aria-label="Main">
          <button type="button" className="nav-pill" onClick={scrollToHowTo}>
            <HowToIcon />
            How to
          </button>
          <button type="button" className="nav-pill" onClick={scrollToAbout}>
            <AboutIcon />
            About
          </button>
        </nav>
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
          <button type="button" className="nav-pill" onClick={scrollToHowTo}>
            <HowToIcon />
            How to
          </button>
          <button type="button" className="nav-pill" onClick={scrollToAbout}>
            <AboutIcon />
            About
          </button>
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
