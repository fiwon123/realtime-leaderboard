import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { ScoreForm } from './ScoreForm'
import { server } from '../test/mocks/server'

describe('ScoreForm', () => {
  it('submits a score and reports it was stored', async () => {
    const user = userEvent.setup()
    render(<ScoreForm />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.type(screen.getByLabelText('Score'), '100')
    await user.click(screen.getByRole('button', { name: /submit score/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      /stored 100 for alice/i,
    )
  })

  it('reports an idempotent replay', async () => {
    server.use(
      http.post('/scores', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...body, duplicate: true }, { status: 200 })
      }),
    )
    const user = userEvent.setup()
    render(<ScoreForm />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.type(screen.getByLabelText('Score'), '100')
    await user.click(screen.getByRole('button', { name: /submit score/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      /already ingested/i,
    )
  })

  it('calls onSubmitted after a successful submit', async () => {
    const onSubmitted = vi.fn()
    const user = userEvent.setup()
    render(<ScoreForm onSubmitted={onSubmitted} />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.type(screen.getByLabelText('Score'), '5')
    await user.click(screen.getByRole('button', { name: /submit score/i }))

    await screen.findByRole('status')
    expect(onSubmitted).toHaveBeenCalledOnce()
  })

  it('refuses a blank player id without calling the API', async () => {
    const user = userEvent.setup()
    render(<ScoreForm />)

    await user.type(screen.getByLabelText('Score'), '5')
    await user.click(screen.getByRole('button', { name: /submit score/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /enter a player id/i,
    )
  })

  it('surfaces a server error', async () => {
    server.use(
      http.post('/scores', () =>
        HttpResponse.json({ error: 'internal server error' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    render(<ScoreForm />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.type(screen.getByLabelText('Score'), '5')
    await user.click(screen.getByRole('button', { name: /submit score/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /internal server error/i,
    )
  })
})
