import { useState } from 'react'

interface AboutProps {
  /** Controlled visibility, owned by the parent so a nav link can reveal it. */
  open?: boolean
  /** Called when the toggle is used, so a controlled parent can update. */
  onOpenChange?: (open: boolean) => void
  showTutorialAgain?: () => void
}

/**
 * The About panel. Open by default so the project blurb is discoverable; when
 * `open` is provided the parent controls it (a header/footer link can reveal
 * and scroll to it).
 */
export function About({ open, onOpenChange, showTutorialAgain }: AboutProps) {
  const [internalOpen, setInternalOpen] = useState(true)
  const shown = open ?? internalOpen

  function toggle() {
    const next = !shown
    setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <section className="panel panel-about" aria-labelledby="about-heading">
      <div className="section-header">
        <h2 id="about-heading">About</h2>
        <button
          type="button"
          className="toggle"
          onClick={toggle}
          aria-expanded={shown}
        >
          {shown ? 'Hide' : 'Learn more'}
        </button>
      </div>
      {shown && (
        <div className="about-content">
          <p className="muted">
            This is a real-time leaderboard service. Score events are submitted,
            stored durably in PostgreSQL, and ranked live in Redis.
          </p>
          <ol className="tutorial-steps">
            <li>Submit a score event for a player.</li>
            <li>Look up any player&apos;s live rank.</li>
            <li>
              Page through the top of the board — or switch on{' '}
              <strong>Live</strong> to auto-refresh it every 5 seconds.
            </li>
          </ol>
          {showTutorialAgain !== undefined && (
            <button
              type="button"
              className="tutorial-dismiss"
              onClick={showTutorialAgain}
            >
              Show tutorial again
            </button>
          )}
        </div>
      )}
    </section>
  )
}
