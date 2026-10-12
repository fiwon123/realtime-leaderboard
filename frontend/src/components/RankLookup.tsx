import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, getRank } from '../api/client'
import type { RankResponse } from '../api/types'
import { PlayerInput } from './PlayerInput'

interface RankLookupProps {
  /** Page the leaderboard to the rank that was just looked up. */
  onJumpToRank?: (rank: number) => void
}

export function RankLookup({ onJumpToRank }: RankLookupProps) {
  const [playerId, setPlayerId] = useState('')
  const [rank, setRank] = useState<RankResponse | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setRank(null)
    setNotFound(false)

    const player = playerId.trim()
    if (player === '') {
      setError('Enter a player id.')
      return
    }

    setBusy(true)
    try {
      setRank(await getRank(player))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true)
      } else {
        setError(
          err instanceof ApiError ? err.message : 'Unexpected error looking up the rank.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  function showOnBoard() {
    if (rank === null) {
      return
    }
    onJumpToRank?.(rank.rank)
    // Best-effort scroll; jsdom does not implement scrollIntoView.
    const heading = document.getElementById('leaderboard-heading')
    if (typeof heading?.scrollIntoView === 'function') {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <section className="panel panel-rank" aria-labelledby="rank-lookup-heading">
      <h2 id="rank-lookup-heading">Player rank</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="rank-player">Player</label>
        <PlayerInput
          id="rank-player"
          name="player_id"
          value={playerId}
          onChange={setPlayerId}
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Looking up…' : 'Look up rank'}
        </button>
      </form>

      {error !== null && <p role="alert" className="error">{error}</p>}
      {notFound && <p role="status">No standing yet for that player.</p>}
      {rank !== null && (
        <div className="rank-result">
          <p role="status" className="success">
            {rank.player_id} is rank {rank.rank} with {rank.score}.
          </p>
          {onJumpToRank !== undefined && (
            <button type="button" className="link-button" onClick={showOnBoard}>
              Show on leaderboard
            </button>
          )}
        </div>
      )}
    </section>
  )
}
