/** Persisted tutorial-dismissal helpers (localStorage-backed, best-effort). */

const STORAGE_KEY = 'tutorial-dismissed'

/** True when the user previously dismissed the tutorial on this browser. */
export function isTutorialDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Clear the persisted dismissal so the tutorial shows again. */
export function resetTutorialDismissal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // No persistence available; the next render still shows it.
  }
}

/** Persist that the user dismissed the tutorial. */
export function persistTutorialDismissal(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // No persistence available; it stays dismissed for this session.
  }
}
