// Backend tools an owner registers so the AI planner can hand off requests
// that need real backend work — not just page changes. We never execute
// anything ourselves; we call the owner's own endpoint and relay what it
// says back to the end user.

import { query } from './db.js'

function toDTO(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    endpointUrl: row.endpoint_url,
    inputSchema: row.input_schema,
    secret: row.secret,
    enabled: row.enabled,
  }
}

export async function listToolsForProject(projectId, { enabledOnly = false } = {}) {
  const { rows } = await query(
    `select * from tools where project_id = $1 ${enabledOnly ? 'and enabled = true' : ''} order by created_at`,
    [projectId]
  )
  return rows.map(toDTO)
}

export async function findToolBySlug(projectId, slug) {
  const { rows } = await query('select * from tools where project_id = $1 and slug = $2', [projectId, slug])
  return rows[0] ? toDTO(rows[0]) : null
}

export async function createTool(projectId, { slug, name, description, endpointUrl, inputSchema }) {
  const { rows } = await query(
    `insert into tools (project_id, slug, name, description, endpoint_url, input_schema)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (project_id, slug)
     do update set name = excluded.name, description = excluded.description,
       endpoint_url = excluded.endpoint_url, input_schema = excluded.input_schema
     returning *`,
    [projectId, slug, name, description || '', endpointUrl, inputSchema || { type: 'object', properties: {} }]
  )
  return toDTO(rows[0])
}

export async function setToolEnabled(projectId, toolId, enabled) {
  const { rows } = await query(
    `update tools set enabled = $1 where project_id = $2 and id = $3 returning *`,
    [Boolean(enabled), projectId, toolId]
  )
  return rows[0] ? toDTO(rows[0]) : null
}

// Calls the owner's endpoint with the args the model filled in. The owner's
// server is trusted to do the real work and to say what happened — we only
// relay `message` back to the end user. Any failure (network, timeout,
// non-2xx, bad JSON) becomes a plain refusal rather than a thrown error, so
// one flaky customer backend can't take down the chat endpoint.
export async function invokeTool(tool, args, { userId, route, project }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(tool.endpointUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-uxaura-tool-secret': tool.secret },
      body: JSON.stringify({ tool: tool.slug, args, userId, route, project: { id: project.id, slug: project.slug } }),
      signal: controller.signal,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.ok === false) {
      return { ok: false, message: body.error || body.message || "That didn't go through on their end." }
    }
    return { ok: true, message: body.message || 'Done.' }
  } catch {
    return { ok: false, message: "Couldn't reach that right now — try again in a moment." }
  } finally {
    clearTimeout(timeout)
  }
}
