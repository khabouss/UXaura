// The Map + live Boundary state, merged, per project — replaces the old
// hardcoded map.js + in-memory boundaries.js. Every anchor here was either
// hand-added by the project owner (no scanner yet) or, one day, produced by
// a real build-time scan.

import { query } from './db.js'

function toDTO(row) {
  return {
    dbId: row.id,
    key: row.anchor_key,
    name: row.name,
    description: row.description,
    route: row.route,
    locked: row.locked,
    lockReason: row.lock_reason || "This part is protected and can't be changed.",
  }
}

export async function listAnchorsForRoute(projectId, route) {
  const { rows } = await query(
    'select * from anchors where project_id = $1 and route = $2 order by created_at',
    [projectId, route]
  )
  return rows.map(toDTO)
}

export async function listAllAnchors(projectId) {
  const { rows } = await query('select * from anchors where project_id = $1 order by route, created_at', [
    projectId,
  ])
  return rows.map(toDTO)
}

export async function findAnchor(projectId, route, anchorKey) {
  const { rows } = await query(
    'select * from anchors where project_id = $1 and route = $2 and anchor_key = $3',
    [projectId, route, anchorKey]
  )
  return rows[0] ? toDTO(rows[0]) : null
}

export async function createAnchor(projectId, { route, anchorKey, name, description }) {
  const { rows } = await query(
    `insert into anchors (project_id, route, anchor_key, name, description)
     values ($1, $2, $3, $4, $5)
     on conflict (project_id, route, anchor_key)
     do update set name = excluded.name, description = excluded.description
     returning *`,
    [projectId, route, anchorKey, name, description || null]
  )
  return toDTO(rows[0])
}

// Bulk upsert from a scan. Never touches locked/lockReason on an existing
// anchor — a re-scan must not silently reopen something the owner
// protected. Anchors that exist in the DB but weren't in this scan are left
// alone too; a scan only ever adds or refreshes names, never deletes.
export async function bulkUpsertAnchors(projectId, anchors) {
  const created = []
  const updated = []
  for (const a of anchors) {
    const existing = await findAnchor(projectId, a.route, a.anchorKey)
    const saved = await createAnchor(projectId, a)
    ;(existing ? updated : created).push(saved)
  }
  return { created, updated }
}

export async function setBoundary(projectId, route, anchorKey, locked, reason) {
  const { rows } = await query(
    `update anchors set locked = $1, lock_reason = $2
     where project_id = $3 and route = $4 and anchor_key = $5
     returning *`,
    [Boolean(locked), reason || null, projectId, route, anchorKey]
  )
  return rows[0] ? toDTO(rows[0]) : null
}
