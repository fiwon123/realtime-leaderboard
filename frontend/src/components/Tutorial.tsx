import { useState } from 'react'
import {
  isTutorialDismissed,
  persistTutorialDismissal,
} from '../lib/tutorial'

interface TutorialProps {
  /** Controlled visibility, owned by the parent so a nav link can reveal it. */
  visible?: boolean
  /** Called after the user dismisses it, so the parent can hide it. */
  onDismissed?: () => void
}

/**
 * A dismissible "how it works" strip. When `visible` is omitted it manages its
 * own visibility from the persisted dismissal; when provided it is controlled.
 */
export function Tutorial({ visible, onDismissed }: TutorialProps) {
  const [dismissed, setDismissed] = useState(isTutorialDismissed)
  const shown = visible ?? !dismissed

  if (!shown) {
    return null
  }

  function dismiss() {
    setDismissed(true)
    persistTutorialDismissal()
    onDismissed?.()
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
          Page through the top of the board — or switch on <strong>Live</strong>{' '}
          to auto-refresh it every 5 seconds.
        </li>
      </ol>
      <button type="button" className="tutorial-dismiss" onClick={dismiss}>
        Got it
      </button>
    </section>
  )
}
