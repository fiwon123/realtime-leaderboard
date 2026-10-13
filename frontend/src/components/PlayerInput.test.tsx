import { useState } from 'react'
import type { FormEvent } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { PlayerInput } from './PlayerInput'
import { server } from '../test/mocks/server'

/** `PlayerInput` is controlled; the harness supplies the state it needs. */
function Harness({
  onChange,
  onSelect,
}: {
  onChange?: (value: string) => void
  onSelect?: (playerId: string) => void
}) {
  const [value, setValue] = useState('')
  return (
    <PlayerInput
      id="p"
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
      onSelect={onSelect}
    />
  )
}

describe('PlayerInput', () => {
  it('suggests players for the typed prefix', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByRole('combobox'), 'al')

    const listbox = await screen.findByRole('listbox')
    expect(listbox).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'alice' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'al' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'bob' })).not.toBeInTheDocument()
  })

  it('debounces so each settled prefix triggers one request', async () => {
    const prefixes: string[] = []
    server.use(
      http.get('/players', ({ request }) => {
        const prefix = new URL(request.url).searchParams.get('prefix') ?? ''
        prefixes.push(prefix)
        return HttpResponse.json({ players: [] })
      }),
    )
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByRole('combobox'), 'alice')

    await waitFor(() => expect(prefixes).toContain('alice'))
    expect(prefixes).toEqual(['alice'])
  })

  it('ranks the closest match first', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // "al" is an exact id, so it must outrank the longer prefix "alice".
    await user.type(screen.getByRole('combobox'), 'al')
    await screen.findByRole('listbox')

    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['al', 'alice'])
  })

  it('highlights the matched part of a suggestion', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByRole('combobox'), 'li')
    const option = await screen.findByRole('option', { name: 'alice' })

    const match = within(option).getByText('li')
    expect(match.tagName).toBe('STRONG')
  })

  it('picks a suggestion with the keyboard', async () => {
    const onChange = vi.fn()
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} onSelect={onSelect} />)

    // No exact "ali" id exists, so the only suggestion (and the pick) is alice.
    await user.type(screen.getByRole('combobox'), 'ali')
    await screen.findByRole('listbox')

    await user.keyboard('{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenCalledWith('alice')
    expect(onChange).toHaveBeenLastCalledWith('alice')
  })

  it('picks a suggestion with the mouse', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)

    await user.type(screen.getByRole('combobox'), 'b')
    await user.click(await screen.findByRole('option', { name: 'bob' }))

    expect(onChange).toHaveBeenLastCalledWith('bob')
  })

  it('lets Enter submit the form when no suggestion is active', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    )

    const input = screen.getByRole('combobox')
    await user.type(input, 'zzz')
    // No suggestions exist for this prefix, so Enter must fall through.
    await user.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalled()
  })

  it('stays usable when the suggestion lookup fails', async () => {
    server.use(
      http.get('/players', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    render(<Harness />)

    const input = screen.getByRole('combobox')
    await user.type(input, 'alice')

    expect(input).toHaveValue('alice')
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })
})
