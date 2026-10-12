import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders a decorative placeholder', () => {
    const { container } = render(<Skeleton />)
    const el = container.querySelector('.skeleton')

    expect(el).not.toBeNull()
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies the requested width and height', () => {
    const { container } = render(<Skeleton width="4rem" height="1rem" />)
    const el = container.querySelector('.skeleton') as HTMLElement

    expect(el.style.width).toBe('4rem')
    expect(el.style.height).toBe('1rem')
  })
})
