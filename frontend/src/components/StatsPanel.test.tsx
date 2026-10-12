import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { StatsPanel } from './StatsPanel'
import { server } from '../test/mocks/server'

describe('StatsPanel', () => {
  it('shows the board size and peak score', async () => {
    render(<StatsPanel />)

    expect(await screen.findByText('2')).toBeInTheDocument()
    expect(screen.getByText('900')).toBeInTheDocument()
  })

  it('shows an error when the stats cannot be loaded', async () => {
    server.use(
      http.get('/stats', () =>
        HttpResponse.json({ error: 'board store failed' }, { status: 500 }),
      ),
    )

    render(<StatsPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /board store failed/i,
    )
  })
})
