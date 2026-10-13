import { CollapsiblePanel } from './CollapsiblePanel'

/**
 * The "How to use" panel. The steps used to live inside About; they are split
 * out so each collapsible panel has one job — About says what the project is,
 * How to describes the three ways to play with the board.
 */
export function HowTo() {
  return (
    <CollapsiblePanel
      id="howto"
      title="How to use"
      className="panel panel-howto"
    >
      {/* Each step wraps its text in a single span so the flex row has exactly
          two items — the counter badge and the text. Otherwise an inline
          <strong> becomes its own flex item and the sentence after it wraps to
          a new line flush against the left edge. */}
      <ol className="howto-steps">
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
    </CollapsiblePanel>
  )
}