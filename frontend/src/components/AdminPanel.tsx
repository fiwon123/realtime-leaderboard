import { useState } from 'react'
import { ApiError, clearScores, deletePlayer } from '../api/client'
import { PlayerInput } from './PlayerInput'

interface AdminPanelProps {
  /** Called after a successful delete/clear so the caller can refresh the board. */
  onChanged?: () => void
}

/** Key the admin token is kept under. Session-scoped: cleared when the tab closes. */
const TOKEN_KEY = 'adminToken'

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return 'Invalid admin token.'
    }
    if (err.status === 503) {
      return 'Admin API is disabled — set ADMIN_TOKEN on the server.'
    }
    return err.message
  }
  return 'Unexpected error.'
}

/**
 * Token-gated admin controls: remove a single player or clear the whole board.
 * The token is kept in `sessionStorage` so it survives a reload but not a new
 * tab, and is never sent anywhere except the `Authorization` header.
 */
export function AdminPanel({ onChanged }: AdminPanelProps) {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) ?? '',
  )
  const [playerId, setPlayerId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)

  function updateToken(next: string) {
    setToken(next)
    if (next.trim() === '') {
      sessionStorage.removeItem(TOKEN_KEY)
    } else {
      sessionStorage.setItem(TOKEN_KEY, next)
    }
  }

  function reset() {
    setError(null)
    setMessage(null)
  }

  async function handleDeletePlayer() {
    reset()
    const player = playerId.trim()
    if (player === '') {
      setError('Enter a player id to delete.')
      return
    }

    setBusy(true)
    try {
      await deletePlayer(player, token.trim())
      setMessage(`Deleted ${player}.`)
      setPlayerId('')
      onChanged?.()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    // Two-step: the first click arms the destructive action.
    if (!confirmingClear) {
      reset()
      setConfirmingClear(true)
      return
    }

    setConfirmingClear(false)
    setBusy(true)
    try {
      await clearScores(token.trim())
      setMessage('Cleared all players.')
      setPlayerId('')
      onChanged?.()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel panel-admin" aria-labelledby="admin-heading">
      <h2 id="admin-heading">Admin</h2>
      <p className="muted">
        Destructive actions, guarded by the server's <code>ADMIN_TOKEN</code>.
        The token stays in this browser tab.
      </p>

      {/* A form (as in the other panels) gives the fields a consistent
          column/gap rhythm; the buttons are `type="button"`, so this never
          submits, and Enter must not reload the page. */}
      <form onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="admin-token">Admin token</label>
        <input
          id="admin-token"
          name="admin_token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => updateToken(event.target.value)}
        />

        <label htmlFor="admin-player">Delete player</label>
        <PlayerInput
          id="admin-player"
          name="delete_player_id"
          value={playerId}
          onChange={setPlayerId}
        />

        <div className="admin-actions">
          <button type="button" onClick={handleDeletePlayer} disabled={busy}>
            {busy ? 'Working…' : 'Delete player'}
          </button>
          <button
            type="button"
            className={confirmingClear ? 'danger' : undefined}
            onClick={handleClear}
            disabled={busy}
          >
            {confirmingClear ? 'Confirm clear all' : 'Clear all players'}
          </button>
        </div>
      </form>

      {confirmingClear && (
        <p className="muted" role="status">
          This deletes every player. Click again to confirm.
        </p>
      )}

      {error !== null && <p role="alert" className="error">{error}</p>}
      {message !== null && <p role="status" className="success">{message}</p>}
    </section>
  )
}
