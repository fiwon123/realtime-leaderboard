import { useState } from 'react'
import { Leaderboard } from './components/Leaderboard'
import { RankLookup } from './components/RankLookup'
import { ScoreForm } from './components/ScoreForm'
import './App.css'

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <main>
      <h1>Realtime Leaderboard</h1>
      <p className="tagline">
        Submit score events and read the live ranking.
      </p>
      <div className="panels">
        <ScoreForm onSubmitted={() => setRefreshKey((key) => key + 1)} />
        <RankLookup />
        <Leaderboard refreshKey={refreshKey} />
      </div>
    </main>
  )
}
