import { useCallback, useEffect, useRef, useState } from 'react'

// Configurable so the dashboard can point at a server that isn't on the
// same machine — set VITE_API_BASE_URL in apps/dashboard/.env. Falls back
// to localhost:4000 for local dev with zero setup.
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
const ROUTE_LABELS = { '/': 'Home', '/product': 'Product' }

export default function App() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/admin/boundaries`)
      .then((r) => r.json())
      .then((data) => {
        setRows(data.boundaries)
        setError(null)
      })
      .catch(() => setError(`Couldn't reach the server at ${API}. Is it running?`))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function updateBoundary(anchorId, locked, reason) {
    setRows((prev) => prev.map((r) => (r.anchorId === anchorId ? { ...r, locked, reason } : r)))
    await fetch(`${API}/api/admin/boundaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anchorId, locked, reason }),
    })
  }

  const byRoute = rows.reduce((acc, r) => {
    ;(acc[r.route] ??= []).push(r)
    return acc
  }, {})

  const protectedCount = rows.filter((r) => r.locked).length

  return (
    <div className="wrap">
      <header className="page-header">
        <h1>Boundaries</h1>
        <p>
          Decide what users of <strong>Acme Shop</strong> may change for themselves. Protected parts refuse every
          request instantly — no approval, no queue — and take effect the moment you toggle them.
        </p>
      </header>

      {error && <div className="banner-error">{error}</div>}
      {loading && !rows.length && <p className="muted">Loading…</p>}

      {Object.entries(byRoute).map(([route, anchors]) => (
        <section key={route} className="route-group">
          <h2>{ROUTE_LABELS[route] || route}</h2>
          <div className="rows">
            {anchors.map((a) => (
              <BoundaryRow key={a.anchorId} anchor={a} onChange={updateBoundary} />
            ))}
          </div>
        </section>
      ))}

      {rows.length > 0 && (
        <footer className="page-footer">
          {protectedCount} of {rows.length} parts protected across the app.
        </footer>
      )}
    </div>
  )
}

function BoundaryRow({ anchor, onChange }) {
  const [reason, setReason] = useState(anchor.reason || '')
  const editing = useRef(false)

  // Stay in sync with the server's value — including the default reason
  // that gets filled in the moment this gets toggled to Protected — except
  // while the owner is actively typing their own, so we never clobber it.
  useEffect(() => {
    if (!editing.current) setReason(anchor.reason || '')
  }, [anchor.reason])

  return (
    <div className={`row${anchor.locked ? ' row-locked' : ''}`}>
      <div className="row-main">
        <div className="row-name">{anchor.name}</div>
        <div className="row-desc">{anchor.description}</div>
      </div>

      <div className="row-toggle">
        <button
          type="button"
          className={!anchor.locked ? 'toggle-btn active-allow' : 'toggle-btn'}
          onClick={() => onChange(anchor.anchorId, false, reason)}
        >
          Allowed
        </button>
        <button
          type="button"
          className={anchor.locked ? 'toggle-btn active-protect' : 'toggle-btn'}
          onClick={() =>
            onChange(anchor.anchorId, true, reason || `${anchor.name} is protected and can't be changed.`)
          }
        >
          Protected
        </button>
      </div>

      {anchor.locked && (
        <input
          className="reason-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onFocus={() => {
            editing.current = true
          }}
          onBlur={() => {
            editing.current = false
            onChange(anchor.anchorId, true, reason)
          }}
          placeholder="Reason shown to the user when they ask"
        />
      )}
    </div>
  )
}
