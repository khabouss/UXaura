// End-user rules, DB-backed, scoped by project. The DTO shape here is load-
// bearing — it must match exactly what the published `uxaura` SDK already
// expects on the wire (rule.when.route, rule.targetName, etc.), since that
// package is out in the world and we can't silently change its contract.

import { query } from './db.js'

function toDTO(row) {
  return {
    id: row.id,
    userId: row.end_user_id,
    when: { route: row.route },
    target: row.target,
    targetName: row.target_name,
    action: row.action,
    params: row.params,
    state: row.state,
    createdFrom: row.created_from,
    createdAt: row.created_at,
  }
}

export async function getRules(projectId, endUserId) {
  const { rows } = await query('select * from rules where project_id = $1 and end_user_id = $2 order by created_at', [
    projectId,
    endUserId,
  ])
  return rows.map(toDTO)
}

export async function getActiveRules(projectId, endUserId, route) {
  const { rows } = await query(
    `select * from rules where project_id = $1 and end_user_id = $2 and route = $3 and state = 'active'`,
    [projectId, endUserId, route]
  )
  return rows.map(toDTO)
}

export async function findConflict(projectId, endUserId, route, target) {
  const { rows } = await query(
    `select * from rules where project_id = $1 and end_user_id = $2 and route = $3 and target = $4 and state = 'active'`,
    [projectId, endUserId, route, target]
  )
  return rows[0] ? toDTO(rows[0]) : null
}

export async function addRule(projectId, endUserId, { route, target, targetName, action, params, createdFrom }) {
  const { rows } = await query(
    `insert into rules (project_id, end_user_id, route, target, target_name, action, params, created_from)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [projectId, endUserId, route, target, targetName || null, action, JSON.stringify(params || {}), createdFrom || null]
  )
  return toDTO(rows[0])
}

export async function findRule(projectId, ruleId) {
  const { rows } = await query('select * from rules where project_id = $1 and id = $2', [projectId, ruleId])
  return rows[0] ? toDTO(rows[0]) : null
}

export async function setRuleState(projectId, ruleId, state) {
  const { rows } = await query('update rules set state = $1 where project_id = $2 and id = $3 returning *', [
    state,
    projectId,
    ruleId,
  ])
  return rows[0] ? toDTO(rows[0]) : null
}

export async function recordEvent(projectId, kind, route) {
  await query('insert into events (project_id, kind, route) values ($1,$2,$3)', [projectId, kind, route || null])
}

export async function getCounters(projectId) {
  const { rows } = await query(
    `select kind, count(*)::int as count from events where project_id = $1 group by kind`,
    [projectId]
  )
  const counters = { granted: 0, refused: 0, clarified: 0 }
  for (const row of rows) counters[row.kind] = row.count
  return counters
}
