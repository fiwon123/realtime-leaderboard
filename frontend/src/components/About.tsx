/**
 * The About band. It sits at the top of the page, spans the full width, and is
 * always visible: what the project is, followed by the steps a visitor can
 * take. The steps double as the "How to" target, so there is one how-it-works
 * list on the page rather than two.
 */
export function About() {
  return (
    <section className="panel panel-about" aria-labelledby="about-heading">
      <div className="section-header">
        <h2 id="about-heading">About this project</h2>
      </div>
      <div className="about-content">
        <p>
          A real-time leaderboard service. Score events are submitted, stored
          durably in PostgreSQL, and ranked live in Redis sorted sets — so
          rankings stay low-latency as the board grows.
        </p>
        <h3 id="about-steps-heading" className="about-subheading">
          What you can do
        </h3>
        {/* Each step wraps its text in a single span so the flex row has
            exactly two items — the counter badge and the text. Otherwise an
            inline <strong> becomes its own flex item and the sentence after it
            wraps to a new line flush against the left edge. */}
        <ol className="about-steps">
          <li>
            <span>Submit a score event for a player.</span>
          </li>
          <li>
            <span>Look up any player&apos;s live rank.</span>
          </li>
          <li>
            <span>
              Page through the top of the board — or switch on{' '}
              <strong>Live</strong> to auto-refresh it every 5 seconds.
            </span>
          </li>
        </ol>
      </div>
    </section>
  )
}
