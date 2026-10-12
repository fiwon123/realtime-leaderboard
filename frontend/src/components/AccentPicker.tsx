import { useEffect, useState } from 'react'
import { ACCENTS, DEFAULT_ACCENT, isAccent, type Accent } from '../lib/accent'

function storedAccent(): Accent {
  try {
    const saved = localStorage.getItem('accent')
    if (isAccent(saved)) {
      return saved
    }
  } catch {
    // localStorage unavailable; fall back to the default accent.
  }
  return DEFAULT_ACCENT
}

/**
 * Swatch row that switches the accent colour. Writes `data-accent` on <html>
 * (which the pre-paint bootstrap in index.html already understands) and
 * persists the choice; picking the default clears the stored override.
 */
export function AccentPicker() {
  const [accent, setAccent] = useState<Accent>(storedAccent)

  useEffect(() => {
    const root = document.documentElement
    try {
      if (accent === DEFAULT_ACCENT) {
        delete root.dataset.accent
        localStorage.removeItem('accent')
      } else {
        root.dataset.accent = accent
        localStorage.setItem('accent', accent)
      }
    } catch {
      // No persistence available; the in-memory accent still applies.
      root.dataset.accent = accent
    }
  }, [accent])

  return (
    <div className="accent-picker" role="group" aria-label="Accent colour">
      {ACCENTS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="accent-swatch"
          style={{ background: `var(--accent-swatch-${id})` }}
          aria-label={`Accent: ${label.toLowerCase()}`}
          aria-pressed={accent === id}
          onClick={() => setAccent(id)}
        />
      ))}
    </div>
  )
}
