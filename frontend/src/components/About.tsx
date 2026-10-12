import { useState } from 'react'

interface AboutProps {
  /** Controlled visibility, owned by the parent so a nav link can reveal it. */
  open?: boolean
  /** Called when the toggle is used, so a controlled parent can update. */
  onOpenChange?: (open: boolean) => void
  showTutorialAgain?: () => void
}

/**
 * The About band. It spans the full width below the panels and, on wide
 * screens, splits into two columns: what the project is (left) and what you
 * can do (right). Open by default so the blurb is discoverable; when `open` is
 * provided the parent controls it (a header/footer link can reveal and scroll
 * to it).
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
        <h2 id="about-heading">About this project</h2>
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
          <div className="about-column">
            <p>
              A real-time leaderboard service. Score events are submitted, stored
              durably in PostgreSQL, and ranked live in Redis sorted sets — so
              rankings stay low-latency as the board grows.
            </p>
            <ul className="about-stack">
              <li>Rust · Axum on Tokio</li>
              <li>PostgreSQL · sqlx</li>
              <li>Redis sorted sets</li>
            </ul>
          </div>
          <div className="about-column">
            <h3 className="about-subheading">What you can do</h3>
            <ol className="tutorial-steps">
              <li>Submit a score event for a player.</li>
              <li>Look up any player&apos;s live rank.</li>
              <li>
                Page through the top of the board — or switch on{' '}
                <strong>Live</strong> to auto-refresh it every 5 seconds.
              </li>
            </ol>
            <div className="about-actions">
              {showTutorialAgain !== undefined && (
                <button type="button" onClick={showTutorialAgain}>
                  Show tutorial again
                </button>
              )}
              <a className="about-link" href="/swagger-ui/">
                API docs
              </a>
              <a
                className="about-link"
                href="https://github.com/fiwon123/realtime-leaderboard"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
