import { useState } from 'react'
import { Leaderboard } from './components/Leaderboard'
import { Logo, LogoMark } from './components/Logo'
import { RankLookup } from './components/RankLookup'
import { ScoreForm } from './components/ScoreForm'
import './App.css'

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <header className="app-header">
        <h1 className="brand">
          <Logo />
        </h1>
      </header>
      <main>
        <p className="tagline">
          Submit score events and read the live ranking.
        </p>
        <div className="panels">
          <ScoreForm onSubmitted={() => setRefreshKey((key) => key + 1)} />
          <RankLookup />
          <Leaderboard refreshKey={refreshKey} />
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
