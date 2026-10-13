import { CollapsiblePanel } from './CollapsiblePanel'

/**
 * The About panel — what the project is, not how to use it (that lives in the
 * How to panel). Collapsible like How to, and expanded by default.
 */
export function About() {
  return (
    <CollapsiblePanel
      id="about"
      title="About this project"
      className="panel panel-about"
    >
      <div className="about-content">
        <p>
          A real-time leaderboard service. Score events are submitted, stored
          durably in PostgreSQL, and ranked live in Redis sorted sets — so
          rankings stay low-latency as the board grows.
        </p>
      </div>
    </CollapsiblePanel>
  )
}