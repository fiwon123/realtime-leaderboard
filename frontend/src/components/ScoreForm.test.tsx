import { render, screen, waitFor } from '@testing-library/react'
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

  it('adds the resulting rank after a successful submit', async () => {
    const user = userEvent.setup()
    render(<ScoreForm />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.type(screen.getByLabelText('Score'), '100')
    await user.click(screen.getByRole('button', { name: /submit score/i }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/now rank 1/i),
    )
  })

  it('still confirms the submit when the rank read fails', async () => {
    server.use(
      http.get('/players/:playerId/rank', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    render(<ScoreForm />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.type(screen.getByLabelText('Score'), '100')
    await user.click(screen.getByRole('button', { name: /submit score/i }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(/stored 100 for alice/i)
    expect(status).not.toHaveTextContent(/now rank/i)
  })

  it('refuses a blank score without calling the API', async () => {
    const user = userEvent.setup()
    render(<ScoreForm />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.click(screen.getByRole('button', { name: /submit score/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /whole-number score/i,
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

  it('reuses the event_id when retrying the same submission', async () => {
    const eventIds: string[] = []
    server.use(
      http.post('/scores', async ({ request }) => {
        const body = (await request.json()) as { event_id: string }
        eventIds.push(body.event_id)
        // Fail the first attempt so the user retries, then succeed.
        if (eventIds.length === 1) {
          return HttpResponse.json(
            { error: 'service unavailable' },
            { status: 503 },
          )
        }
        return HttpResponse.json({ ...body, duplicate: true }, { status: 200 })
      }),
    )
    const user = userEvent.setup()
    render(<ScoreForm />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.type(screen.getByLabelText('Score'), '100')
    const submit = screen.getByRole('button', { name: /submit score/i })

    await user.click(submit)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(submit)
    expect(await screen.findByRole('status')).toHaveTextContent(
      /already ingested/i,
    )

    expect(eventIds).toHaveLength(2)
    expect(eventIds[0]).toBe(eventIds[1])
  })

  it('uses a fresh event_id after a successful submit', async () => {
    const eventIds: string[] = []
    server.use(
      http.post('/scores', async ({ request }) => {
        const body = (await request.json()) as { event_id: string }
        eventIds.push(body.event_id)
        return HttpResponse.json({ ...body, duplicate: false }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    render(<ScoreForm />)

    await user.type(screen.getByLabelText('Player'), 'alice')
    await user.type(screen.getByLabelText('Score'), '100')
    const submit = screen.getByRole('button', { name: /submit score/i })

    await user.click(submit)
    await screen.findByRole('status')
    await user.click(submit)
    await waitFor(() => expect(eventIds).toHaveLength(2))

    expect(eventIds[0]).not.toBe(eventIds[1])
  })
})
