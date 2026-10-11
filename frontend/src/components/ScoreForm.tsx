import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, submitScore } from '../api/client'
import type { ScoreEventResponse } from '../api/types'
import { newEventId } from '../lib/uuid'

interface ScoreFormProps {
  /** Called after a successful submit so the caller can refresh the board. */
  onSubmitted?: () => void
}

export function ScoreForm({ onSubmitted }: ScoreFormProps) {
  const [playerId, setPlayerId] = useState('')
  const [score, setScore] = useState('')
  const [result, setResult] = useState<ScoreEventResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)

    const player = playerId.trim()
    const parsedScore = Number(score)
    if (player === '') {
      setError('Enter a player id.')
      return
    }
    if (!Number.isInteger(parsedScore)) {
      setError('Enter a whole-number score.')
      return
    }

    setBusy(true)
    try {
      // A fresh event_id per submit: a double-click replays the same event and
      // the API answers 200 with `duplicate: true` instead of double-counting.
      const response = await submitScore({
        event_id: newEventId(),
        player_id: player,
        score: parsedScore,
      })
      setResult(response)
      onSubmitted?.()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unexpected error submitting the score.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="score-form-heading">
      <h2 id="score-form-heading">Submit a score</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="score-player">Player</label>
        <input
          id="score-player"
          name="player_id"
          value={playerId}
          onChange={(event) => setPlayerId(event.target.value)}
          autoComplete="off"
        />

        <label htmlFor="score-value">Score</label>
        <input
          id="score-value"
          name="score"
          type="number"
          inputMode="numeric"
          value={score}
          onChange={(event) => setScore(event.target.value)}
        />

        <button type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit score'}
        </button>
      </form>

      {error !== null && <p role="alert" className="error">{error}</p>}

      {result !== null && (
        <p role="status" className="success">
          {result.duplicate
            ? `Replay: event ${result.event_id} was already ingested.`
            : `Stored ${result.score} for ${result.player_id}.`}
        </p>
      )}
    </section>
  )
}
