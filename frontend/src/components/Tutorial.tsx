import { useState } from 'react'

const STORAGE_KEY = 'tutorial-dismissed'

function initiallyDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** A dismissible "how it works" strip; the dismissal persists locally. */
export function Tutorial() {
  const [dismissed, setDismissed] = useState(initiallyDismissed)

  if (dismissed) {
    return null
  }

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // No persistence available; it stays dismissed for this session.
    }
  }

  return (
    <section className="tutorial" aria-labelledby="tutorial-heading">
      <h2 id="tutorial-heading" className="tutorial-title">
        How it works
      </h2>
      <ol className="tutorial-steps">
        <li>Submit a score event for a player.</li>
        <li>Look up any player's live rank.</li>
        <li>
          Page through the top of the board, or turn on <strong>Live</strong> to
          watch it update.
        </li>
      </ol>
      <button type="button" className="tutorial-dismiss" onClick={dismiss}>
        Got it
      </button>
    </section>
  )
}
