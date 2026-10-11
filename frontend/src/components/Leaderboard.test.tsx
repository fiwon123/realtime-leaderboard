import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { Leaderboard } from './Leaderboard'
import { server } from '../test/mocks/server'

describe('Leaderboard', () => {
  it('renders the entries from the API, highest first', async () => {
    render(<Leaderboard />)

    const rows = await screen.findAllByRole('row')
    // header row + two data rows
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('alice')).toBeInTheDocument()
    expect(within(rows[1]).getByText('900')).toBeInTheDocument()
    expect(within(rows[2]).getByText('bob')).toBeInTheDocument()
  })

  it('shows an empty state when there are no scores', async () => {
    server.use(
      http.get('/leaderboard', () => HttpResponse.json({ entries: [] })),
    )

    render(<Leaderboard />)
    expect(await screen.findByRole('status')).toHaveTextContent(
      /no scores yet/i,
    )
  })

  it('shows an error when the API fails', async () => {
    server.use(
      http.get('/leaderboard', () =>
        HttpResponse.json({ error: 'leaderboard store failed' }, { status: 500 }),
      ),
    )

    render(<Leaderboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /leaderboard store failed/i,
    )
  })
})
