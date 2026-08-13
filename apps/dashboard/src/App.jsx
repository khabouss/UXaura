import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { api } from './api.js'
import { AuthScreen } from './AuthScreen.jsx'

const ROUTE_LABELS = { '/': 'Home', '/product': 'Product' }

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="wrap">Loading…</div>
  if (!session) return <AuthScreen />
  return <Dashboard />
}

function Dashboard() {
  const [projects, setProjects] = useState(null)
  const [projectId, setProjectId] = useState(null)

  const loadProjects = useCallback(() => {
    api.listProjects().then((data) => {
      setProjects(data.projects)
      setProjectId((prev) => prev ?? data.projects[0]?.id ?? null)
    })
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  if (!projects) return <div className="wrap">Loading…</div>

  const project = projects.find((p) => p.id === projectId)

  return (
    <div className="wrap">
      <header className="page-header page-header-row">
        <div>
          <h1>Boundaries</h1>
          <p>Decide what your users may change for themselves. Protected parts refuse instantly — no queue.</p>
        </div>
        <button className="link-btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <div className="project-bar">
        {projects.length > 0 && (
          <select value={projectId || ''} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <NewProjectForm onCreated={(p) => { loadProjects(); setProjectId(p.id) }} />
      </div>

      {project && <ProjectDetail key={project.id} project={project} />}
      {!project && <p className="muted">Create a project to get started.</p>}
    </div>
  )
}

function NewProjectForm({ onCreated }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    try {
      const { project } = await api.createProject(name, slug || `project-${Date.now()}`)
      setName('')
      setOpen(false)
      onCreated(project)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!open) {
    return (
      <button className="link-btn" onClick={() => setOpen(true)}>
        + New project
      </button>
    )
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input autoFocus placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit">Create</button>
      {error && <span className="inline-error">{error}</span>}
    </form>
  )
}

function ProjectDetail({ project }) {
  const [anchors, setAnchors] = useState([])
  const [reports, setReports] = useState(null)
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([api.listAnchors(project.id), api.getReports(project.id), api.listTools(project.id)])
      .then(([a, r, t]) => {
        setAnchors(a.boundaries)
        setReports(r.counters)
        setTools(t.tools)
      })
      .finally(() => setLoading(false))
  }, [project.id])

  useEffect(() => {
    load()
  }, [load])

  async function updateBoundary(route, anchorId, locked, reason) {
    setAnchors((prev) => prev.map((a) => (a.anchorId === anchorId && a.route === route ? { ...a, locked, reason } : a)))
    await api.setBoundary(project.id, route, anchorId, locked, reason)
  }

  const byRoute = anchors.reduce((acc, a) => {
    ;(acc[a.route] ??= []).push(a)
    return acc
  }, {})

  return (
    <>
      <div className="key-box">
        <span>Project key</span>
        <code>{project.apiKey}</code>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {Object.entries(byRoute).map(([route, list]) => (
        <section key={route} className="route-group">
          <h2>{ROUTE_LABELS[route] || route}</h2>
          <div className="rows">
            {list.map((a) => (
              <BoundaryRow key={a.anchorId} anchor={a} onChange={(l, r) => updateBoundary(route, a.anchorId, l, r)} />
            ))}
          </div>
        </section>
      ))}

      <AddAnchorForm projectId={project.id} onAdded={load} />

      <ToolsSection projectId={project.id} tools={tools} onChange={load} />

      {reports && (
        <footer className="page-footer">
          {anchors.filter((a) => a.locked).length} of {anchors.length} parts protected · {reports.granted} requests
          granted · {reports.refused} refused · {reports.clarified} clarified
        </footer>
      )}
    </>
  )
}

function AddAnchorForm({ projectId, onAdded }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ route: '/', anchorKey: '', name: '', description: '' })
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    try {
      await api.createAnchor(projectId, form)
      setForm({ route: '/', anchorKey: '', name: '', description: '' })
      setOpen(false)
      onAdded()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!open) {
    return (
      <button className="link-btn add-anchor-btn" onClick={() => setOpen(true)}>
        + Add a part manually
      </button>
    )
  }

  return (
    <form className="anchor-form" onSubmit={submit}>
      <div className="anchor-form-title">
        No scanner yet — describe the part of your app you want users to be able to change.
      </div>
      <div className="anchor-form-row">
        <input
          placeholder="Route, e.g. /"
          value={form.route}
          onChange={(e) => setForm({ ...form, route: e.target.value })}
        />
        <input
          placeholder="Key, e.g. hero-carousel"
          value={form.anchorKey}
          onChange={(e) => setForm({ ...form, anchorKey: e.target.value })}
        />
      </div>
      <input placeholder="Name shown in the dashboard" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      {error && <div className="inline-error">{error}</div>}
      <div className="anchor-form-actions">
        <button type="submit">Add</button>
        <button type="button" className="link-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function ToolsSection({ projectId, tools, onChange }) {
  async function toggle(tool) {
    await api.setToolEnabled(projectId, tool.id, !tool.enabled)
    onChange()
  }

  return (
    <section className="route-group">
      <h2>Backend tools</h2>
      <p className="row-desc" style={{ marginBottom: 12 }}>
        Actions the AI can hand off to your own server — e.g. "apply a discount". Your endpoint does the real work; we
        just call it and relay what it says.
      </p>
      <div className="rows">
        {tools.map((t) => (
          <div key={t.id} className={`row${!t.enabled ? ' row-locked' : ''}`}>
            <div className="row-main">
              <div className="row-name">{t.name}</div>
              <div className="row-desc">{t.description}</div>
              <div className="row-desc">
                <code>{t.endpointUrl}</code>
              </div>
              <div className="row-desc">
                secret: <code>{t.secret}</code>
              </div>
            </div>
            <div className="row-toggle">
              <button
                type="button"
                className={t.enabled ? 'toggle-btn active-allow' : 'toggle-btn'}
                onClick={() => toggle(t)}
              >
                Enabled
              </button>
              <button
                type="button"
                className={!t.enabled ? 'toggle-btn active-protect' : 'toggle-btn'}
                onClick={() => toggle(t)}
              >
                Disabled
              </button>
            </div>
          </div>
        ))}
      </div>
      <AddToolForm projectId={projectId} onAdded={onChange} />
    </section>
  )
}

function AddToolForm({ projectId, onAdded }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ slug: '', name: '', description: '', endpointUrl: '', inputSchema: '' })
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    try {
      await api.createTool(projectId, form)
      setForm({ slug: '', name: '', description: '', endpointUrl: '', inputSchema: '' })
      setOpen(false)
      onAdded()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!open) {
    return (
      <button className="link-btn add-anchor-btn" onClick={() => setOpen(true)}>
        + Add a backend tool
      </button>
    )
  }

  return (
    <form className="anchor-form" onSubmit={submit}>
      <div className="anchor-form-title">
        Your endpoint receives a POST with {'{ tool, args, userId, route, project }'} and header
        x-uxaura-tool-secret. Reply with {'{ message }'} (or {'{ ok: false, error }'}).
      </div>
      <div className="anchor-form-row">
        <input
          placeholder="Slug, e.g. apply_discount"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <input placeholder="Name shown in the dashboard" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <input
        placeholder="Description — tells the AI when to call this"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <input
        placeholder="Endpoint URL, e.g. https://api.yoursite.com/uxaura-tools/apply-discount"
        value={form.endpointUrl}
        onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })}
      />
      <textarea
        placeholder='Input schema (JSON), e.g. {"type":"object","properties":{"code":{"type":"string"}},"required":["code"]}'
        value={form.inputSchema}
        onChange={(e) => setForm({ ...form, inputSchema: e.target.value })}
        rows={3}
      />
      {error && <div className="inline-error">{error}</div>}
      <div className="anchor-form-actions">
        <button type="submit">Add</button>
        <button type="button" className="link-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function BoundaryRow({ anchor, onChange }) {
  const [reason, setReason] = useState(anchor.reason || '')
  const editing = useRef(false)

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
          onClick={() => onChange(false, reason)}
        >
          Allowed
        </button>
        <button
          type="button"
          className={anchor.locked ? 'toggle-btn active-protect' : 'toggle-btn'}
          onClick={() => onChange(true, reason || `${anchor.name} is protected and can't be changed.`)}
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
            onChange(true, reason)
          }}
          placeholder="Reason shown to the user when they ask"
        />
      )}
    </div>
  )
}
