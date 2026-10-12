import { useState } from 'react'
import { DemoSeeder } from './components/DemoSeeder'
import { Leaderboard } from './components/Leaderboard'
import { Logo, LogoMark } from './components/Logo'
import { RankLookup } from './components/RankLookup'
import { ScoreForm } from './components/ScoreForm'
import { StatsPanel } from './components/StatsPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { Tutorial } from './components/Tutorial'
import './App.css'

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = () => setRefreshKey((key) => key + 1)

  return (
    <>
      <header className="app-header">
        <h1 className="brand">
          <Logo />
        </h1>
        <ThemeToggle />
      </header>
      <main>
        <p className="tagline">
          Submit score events and read the live ranking.
        </p>
        <Tutorial />
        <div className="panels">
          <ScoreForm onSubmitted={bump} />
          <RankLookup />
          <Leaderboard refreshKey={refreshKey} />
          <StatsPanel />
          <DemoSeeder onSeeded={bump} />
        </div>
      </main>
      <footer className="app-footer">
        <LogoMark className="footer-mark" />
        <span className="footer-note">Rust · Postgres · Redis · React</span>
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
