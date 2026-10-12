import { useState } from 'react'

interface AboutProps {
  showTutorialAgain?: () => void
}

export function About({ showTutorialAgain }: AboutProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className="panel panel-about" aria-labelledby="about-heading">
      <div className="section-header">
        <h2 id="about-heading">About</h2>
        <button
          type="button"
          className="toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'Hide' : 'Learn more'}
        </button>
      </div>
      {open && (
        <div className="about-content">
          <p className="muted">
            This is a real-time leaderboard service. Score events are submitted,
            stored durably in PostgreSQL, and ranked live in Redis.
          </p>
          <ol className="tutorial-steps">
            <li>Submit a score event for a player.</li>
            <li>Look up any player&apos;s live rank.</li>
            <li>Page the top of the board, or turn on Live to watch it update.</li>
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
