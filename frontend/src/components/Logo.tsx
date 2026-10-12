import { useId } from 'react'

interface LogoMarkProps {
  className?: string
}

/**
 * The brand mark: a gradient trophy cup with a gold spark.
 *
 * Rendered inline (not an `<img>`) so it scales crisply and can pick up layout
 * styles. `useId` keeps the gradient id unique when the mark appears more than
 * once on a page (header and footer). `TrophyMark` is exported for the
 * leaderboard empty state, which reuses the same silhouette.
 */
export function LogoMark({ className }: LogoMarkProps) {
  const gradientId = `logo-trophy-${useId().replace(/:/g, '')}`

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
        {/* cup */}
        <path d="M9 6 H23 V12 Q23 18 16 18 Q9 18 9 12 Z" />
        {/* stem */}
        <rect x="14.5" y="17" width="3" height="5" />
        {/* base */}
        <rect x="9.5" y="22" width="13" height="3" rx="1.5" />
      </g>
      <g
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        {/* handles */}
        <path d="M9 8.5 C5 8.5 5 14 9 14" />
        <path d="M23 8.5 C27 8.5 27 14 23 14" />
      </g>
      {/* gold spark */}
      <path
        d="M16 8.5 L17.03 10.97 L19.5 12 L17.03 13.03 L16 15.5 L14.97 13.03 L12.5 12 L14.97 10.97 Z"
        fill="#f59e0b"
      />
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
