import { useEffect, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

function prefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

function resolve(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme
}

function storedTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') {
      return saved
    }
  } catch {
    // localStorage unavailable; fall back to the system preference.
  }
  return 'system'
}

/**
 * Cycles system → light → dark, writing `data-theme` on <html> (which the
 * pre-paint bootstrap in index.html already understands) and persisting the
 * choice. "system" clears the stored override.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(storedTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = resolve(theme)
    try {
      if (theme === 'system') {
        localStorage.removeItem('theme')
      } else {
        localStorage.setItem('theme', theme)
      }
    } catch {
      // No persistence available; the in-memory theme still applies.
    }
  }, [theme])

  function cycle() {
    setTheme((current) =>
      current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system',
    )
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`Theme: ${theme}. Click to change.`}
    >
      {theme}
    </button>
  )
}
