import { useEffect, useState, type ReactNode } from 'react'

interface CollapsiblePanelProps {
  /** Panel id; also keys the minimized state in localStorage. */
  id: string
  /** Title shown on the clickable panel header. */
  title: string
  /** Optional extra header controls rendered beside the title. */
  actions?: ReactNode
  /** Panel content; hidden while the panel is minimized. */
  children: ReactNode
  className?: string
}

/**
 * A section with a clickable accordion header. Clicking the title expands or
 * minimizes the panel; a minimized panel is remembered in localStorage and
 * starts restored on the next visit, while panels default to expanded on
 * first visit (no stored choice).
 */
export function CollapsiblePanel({
  id,
  title,
  actions,
  children,
  className,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(() => {
    try {
      if (localStorage.getItem(`panel:${id}:open`) === 'false') {
        return false
      }
    } catch {
      // Storage unavailable; start expanded.
    }
    return true
  })

  useEffect(() => {
    try {
      // Only a minimized panel needs remembering — expanding clears the flag.
      if (open) {
        localStorage.removeItem(`panel:${id}:open`)
      } else {
        localStorage.setItem(`panel:${id}:open`, 'false')
      }
    } catch {
      // No persistence available; the in-memory state still applies.
    }
  }, [open, id])

  const headingId = `${id}-heading`
  const bodyId = `${id}-body`

  return (
    <section className={className} aria-labelledby={headingId}>
      <div className="section-header">
        <h2 id={headingId}>
          <button
            type="button"
            className="panel-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((current) => !current)}
          >
            {title}
            <ChevronIcon />
          </button>
        </h2>
        {actions}
      </div>
      <div id={bodyId} className="panel-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}

/** Small chevron marking the collapse state; decorative. */
function ChevronIcon() {
  return (
    <svg
      className="panel-chevron"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}