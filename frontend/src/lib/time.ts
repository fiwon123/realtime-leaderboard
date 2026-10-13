/**
 * Human-friendly "time since" label for the leaderboard's freshness stamp.
 *
 * `now` and `then` are epoch milliseconds. A `then` in the future (clock skew,
 * or a stale value) clamps to "just now" rather than rendering a negative age.
 */
export function formatRelative(now: number, then: number): string {
  const seconds = Math.max(0, Math.floor((now - then) / 1000))

  if (seconds < 5) {
    return 'just now'
  }
  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${Math.floor(hours / 24)}d ago`
}
