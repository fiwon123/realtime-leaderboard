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
 * Inline mode icon: monitor (system), sun (light), moon (dark). Decorative —
 * the button carries the accessible name.
 */
function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    className: 'theme-icon',
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    'aria-hidden': true,
    focusable: false,
  } as const

  if (theme === 'light') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (theme === 'dark') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
        <path
          d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
    </svg>
  )
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
      <ThemeIcon theme={theme} />
      <span>{theme}</span>
    </button>
  )
}
