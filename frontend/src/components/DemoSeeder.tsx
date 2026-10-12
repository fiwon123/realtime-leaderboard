import { useState } from 'react'
import { ApiError, submitScore } from '../api/client'
import { newEventId } from '../lib/uuid'

interface DemoSeederProps {
  /** Called after a successful seed so the caller can refresh the board. */
  onSeeded?: () => void
}

const SAMPLES = [
  { player_id: 'demo-alice', score: 1200 },
  { player_id: 'demo-bob', score: 950 },
  { player_id: 'demo-carol', score: 780 },
  { player_id: 'demo-dave', score: 640 },
  { player_id: 'demo-eve', score: 510 },
]

/** Submits a handful of sample score events so an empty board can be explored. */
export function DemoSeeder({ onSeeded }: DemoSeederProps) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function seed() {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await Promise.all(
        SAMPLES.map((sample) =>
          submitScore({ event_id: newEventId(), ...sample }),
        ),
      )
      setMessage(`Seeded ${SAMPLES.length} demo players.`)
      onSeeded?.()
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not seed demo data.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="demo-heading">
      <h2 id="demo-heading">Demo data</h2>
      <p className="muted">
        Fill the board with a few sample players to try it out.
      </p>
      <button type="button" onClick={seed} disabled={busy}>
        {busy ? 'Seeding…' : 'Seed demo players'}
      </button>

      {error !== null && <p role="alert" className="error">{error}</p>}
      {message !== null && <p role="status" className="success">{message}</p>}
    </section>
  )
}
