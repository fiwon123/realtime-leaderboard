import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, getRank, submitScore } from '../api/client'
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
  const [rankNote, setRankNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // The `event_id` for the submission currently being attempted, keyed by the
  // values it belongs to. Reusing it across retries makes a resent request an
  // idempotent replay (`200` + `duplicate: true`) rather than a second event,
  // which matters when a response is lost after the server already stored the
  // event. It is cleared on success, so the next submission is a new event, and
  // regenerated when the player or score changes.
  const pending = useRef<{ key: string; eventId: string } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)
    setRankNote(null)

    const player = playerId.trim()
    const parsedScore = Number(score)
    if (player === '') {
      setError('Enter a player id.')
      return
    }
    if (score.trim() === '' || !Number.isInteger(parsedScore)) {
      setError('Enter a whole-number score.')
      return
    }

    const key = `${player}\u0000${parsedScore}`
    const eventId =
      pending.current?.key === key ? pending.current.eventId : newEventId()
    pending.current = { key, eventId }

    setBusy(true)
    try {
      const response = await submitScore({
        event_id: eventId,
        player_id: player,
        score: parsedScore,
      })
      pending.current = null // Success: the next submission is a new event.
      setResult(response)
      onSubmitted?.()

      // Best-effort: show where the player now sits. The submit already
      // succeeded, so a failed rank read must not surface as an error.
      if (!response.duplicate) {
        try {
          const { rank } = await getRank(player)
          setRankNote(` — now rank ${rank}`)
        } catch {
          // Leave the note off; the stored confirmation still shows.
        }
      }
    } catch (err) {
      // Keep `pending` intact so a retry resends the same event_id.
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
    <section className="panel panel-score" aria-labelledby="score-form-heading">
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
            : `Stored ${result.score} for ${result.player_id}${rankNote ?? ''}.`}
        </p>
      )}
    </section>
  )
}
