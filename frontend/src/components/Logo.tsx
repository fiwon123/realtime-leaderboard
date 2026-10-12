import { useId } from 'react'

interface LogoMarkProps {
  className?: string
}

/**
 * The brand mark: three ascending rank bars with a gold realtime bolt.
 *
 * Rendered inline (not an `<img>`) so it scales crisply and can pick up layout
 * styles. `useId` keeps the gradient id unique when the mark appears more than
 * once on a page (header and footer).
 */
export function LogoMark({ className }: LogoMarkProps) {
  const gradientId = `logo-bars-${useId().replace(/:/g, '')}`

  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="32"
          x2="32"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradientId})`}>
        <rect x="3" y="21" width="5" height="9" rx="2.5" />
        <rect x="11" y="16" width="5" height="14" rx="2.5" />
        <rect x="19" y="11" width="5" height="19" rx="2.5" />
      </g>
      <path d="M23 1 L14 12 H18.5 L16.5 20 L26 9 H21.5 L23 1 Z" fill="#f59e0b" />
    </svg>
  )
}

interface LogoProps {
  className?: string
}

/** The full lockup: mark + wordmark, for the app header. */
export function Logo({ className }: LogoProps) {
  return (
    <span className={className === undefined ? 'logo' : `logo ${className}`}>
      <LogoMark className="logo-mark" />
      <span className="logo-wordmark">Realtime Leaderboard</span>
    </span>
  )
}
