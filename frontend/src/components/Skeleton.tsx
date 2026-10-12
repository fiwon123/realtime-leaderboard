interface SkeletonProps {
  /** CSS width, e.g. "60%" or "3rem". Defaults to 100%. */
  width?: string
  /** CSS height. Defaults to one line (1em) via the base class. */
  height?: string
  className?: string
}

/** A shimmering placeholder for content that is still loading. Decorative. */
export function Skeleton({ width, height, className }: SkeletonProps) {
  const classes = className === undefined ? 'skeleton' : `skeleton ${className}`

  return (
    <span className={classes} style={{ width, height }} aria-hidden="true" />
  )
}
