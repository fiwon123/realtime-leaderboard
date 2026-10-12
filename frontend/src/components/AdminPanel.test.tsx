import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { AdminPanel } from './AdminPanel'
import { server } from '../test/mocks/server'

describe('AdminPanel', () => {
  it('deletes a player with the bearer token and reports it', async () => {
    let authorization: string | null = null
    let deleted: string | undefined
    server.use(
      http.delete('/players/:playerId', ({ params, request }) => {
        deleted = String(params.playerId)
        authorization = request.headers.get('authorization')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const onChanged = vi.fn()
    const user = userEvent.setup()
    render(<AdminPanel onChanged={onChanged} />)

    await user.type(screen.getByLabelText('Admin token'), 's3cret')
    await user.type(screen.getByLabelText('Delete player'), 'alice')
    await user.click(screen.getByRole('button', { name: /delete player/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      /deleted alice/i,
    )
    expect(deleted).toBe('alice')
    expect(authorization).toBe('Bearer s3cret')
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it('requires a second click to clear all', async () => {
    const cleared = vi.fn(() =>
      HttpResponse.json({ error: 'nope' }, { status: 500 }),
    )
    server.use(http.delete('/scores', cleared))
    const user = userEvent.setup()
    render(<AdminPanel />)

    await user.type(screen.getByLabelText('Admin token'), 's3cret')

    await user.click(screen.getByRole('button', { name: /clear all players/i }))
    expect(cleared).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: /confirm clear all/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /confirm clear all/i }))
    expect(cleared).toHaveBeenCalledOnce()
  })

  it('reports a wrong token as unauthorized', async () => {
    server.use(
      http.delete('/scores', () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    )
    const user = userEvent.setup()
    render(<AdminPanel />)

    await user.type(screen.getByLabelText('Admin token'), 'nope')
    await user.click(screen.getByRole('button', { name: /clear all players/i }))
    await user.click(screen.getByRole('button', { name: /confirm clear all/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid admin token/i,
    )
  })

  it('explains when the admin API is disabled', async () => {
    server.use(
      http.delete('/players/:playerId', () =>
        HttpResponse.json({ error: 'service unavailable' }, { status: 503 }),
      ),
    )
    const user = userEvent.setup()
    render(<AdminPanel />)

    await user.type(screen.getByLabelText('Admin token'), 's3cret')
    await user.type(screen.getByLabelText('Delete player'), 'alice')
    await user.click(screen.getByRole('button', { name: /delete player/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /admin api is disabled/i,
    )
  })

  it('refuses an empty player id without calling the API', async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)

    await user.click(screen.getByRole('button', { name: /delete player/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /enter a player id/i,
    )
  })

  it('persists the token in sessionStorage', async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)

    await user.type(screen.getByLabelText('Admin token'), 's3cret')

    await waitFor(() =>
      expect(sessionStorage.getItem('adminToken')).toBe('s3cret'),
    )
  })
})
