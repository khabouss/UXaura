// The Boundaries — what the app owner has decided users may not touch.
// Seeded from the Map's own locked flags, then owner-editable through the
// dashboard. The Rulebook is the only thing that reads this for real
// enforcement; the dashboard only writes to it.

import { MAP } from './map.js'

const boundaries = new Map() // anchorId -> { locked: boolean, reason: string }

for (const route of Object.values(MAP.routes)) {
  for (const anchor of route.anchors) {
    boundaries.set(anchor.id, {
      locked: Boolean(anchor.locked),
      reason: anchor.lockReason || '',
    })
  }
}

export function listBoundaries() {
  const rows = []
  for (const [routePath, route] of Object.entries(MAP.routes)) {
    for (const anchor of route.anchors) {
      const b = boundaries.get(anchor.id)
      rows.push({
        anchorId: anchor.id,
        name: anchor.name,
        description: anchor.description,
        route: routePath,
        locked: b.locked,
        reason: b.reason,
      })
    }
  }
  return rows
}

export function isLocked(anchorId) {
  return boundaries.get(anchorId)?.locked ?? false
}

export function lockReason(anchorId) {
  return boundaries.get(anchorId)?.reason || "This part is protected and can't be changed."
}

export function setBoundary(anchorId, locked, reason) {
  if (!boundaries.has(anchorId)) return null
  const value = { locked: Boolean(locked), reason: reason || '' }
  boundaries.set(anchorId, value)
  return { anchorId, ...value }
}
