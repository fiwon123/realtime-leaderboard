import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { searchPlayers } from '../api/client'

/** How long typing must pause before a suggestion request is sent. */
const DEBOUNCE_MS = 150

interface PlayerInputProps {
  /** Matches the `htmlFor` of the label rendered by the caller. */
  id: string
  name?: string
  value: string
  onChange: (value: string) => void
  /** Called when a suggestion is picked, after `onChange`. */
  onSelect?: (playerId: string) => void
  placeholder?: string
  /** Max suggestions to request. Must be 1..=25 to satisfy the API. */
  limit?: number
}

/** A resolved suggestion lookup, tagged with the prefix it answered. */
interface Result {
  prefix: string
  players: string[]
}

/**
 * Wrap the part of `player` that matches the typed term so the reason for the
 * suggestion is visible. Falls back to plain text when there is no match.
 */
function renderMatch(player: string, term: string) {
  const at = term === '' ? -1 : player.toLowerCase().indexOf(term.toLowerCase())
  if (at < 0) {
    return player
  }
  const end = at + term.length
  return (
    <>
      {player.slice(0, at)}
      <strong>{player.slice(at, end)}</strong>
      {player.slice(end)}
    </>
  )
}

/**
 * Player-id text input with a debounced suggestion dropdown backed by
 * `GET /players`. Suggestions are best-effort: a failed lookup leaves the input
 * usable and never surfaces an error, since the raw id can still be typed.
 */
export function PlayerInput({
  id,
  name,
  value,
  onChange,
  onSelect,
  placeholder,
  limit = 5,
}: PlayerInputProps) {
  const listId = useId()
  const [result, setResult] = useState<Result | null>(null)
  // Set by Escape/blur/pick so a dropdown the user dismissed stays closed until
  // a new lookup returns.
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(-1)

  // Monotonic counter so a slow response for an old prefix cannot overwrite a
  // newer one (typing outruns the request).
  const requestId = useRef(0)
  // The exact value set by picking a suggestion, so the change it causes does
  // not immediately reopen the dropdown.
  const justSelected = useRef<string | null>(null)

  const prefix = value.trim()
  // Only show results that answer the current prefix; a result for an older
  // prefix is hidden while the debounce for the new one is still pending.
  const suggestions = result !== null && result.prefix === prefix ? result.players : []
  const open = !dismissed && suggestions.length > 0

  useEffect(() => {
    if (justSelected.current === value) {
      justSelected.current = null
      return
    }

    const prefix = value.trim()
    if (prefix === '') {
      return
    }

    const current = ++requestId.current
    const timer = setTimeout(() => {
      searchPlayers(prefix, limit)
        .then((response) => {
          if (current !== requestId.current) {
            return // Stale: a newer keystroke superseded this request.
          }
          setResult({ prefix, players: response.players })
          setDismissed(false)
          setActive(-1)
        })
        .catch(() => {
          if (current !== requestId.current) {
            return
          }
          setResult({ prefix, players: [] })
          setActive(-1)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [value, limit])

  function choose(playerId: string) {
    justSelected.current = playerId
    onChange(playerId)
    onSelect?.(playerId)
    setDismissed(true)
    setActive(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (suggestions.length === 0) {
        return
      }
      setDismissed(false)
      setActive((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (suggestions.length === 0) {
        return
      }
      setDismissed(false)
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter') {
      if (open && active >= 0 && active < suggestions.length) {
        event.preventDefault()
        choose(suggestions[active])
      }
    } else if (event.key === 'Escape') {
      setDismissed(true)
      setActive(-1)
    }
  }

  return (
    <div className="player-input">
      <input
        id={id}
        name={name}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && active >= 0 ? `${listId}-option-${active}` : undefined
        }
        autoComplete="off"
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setDismissed(true)}
      />

      {open && (
        <ul id={listId} role="listbox" className="player-suggestions">
          {suggestions.map((player, index) => (
            <li
              key={player}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === active}
              className={
                index === active ? 'player-suggestion active' : 'player-suggestion'
              }
              // Prevent the input's blur from closing the list before the click
              // registers.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(player)}
            >
              {renderMatch(player, prefix)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
