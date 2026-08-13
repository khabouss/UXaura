import { query } from './db.js'

function toDTO(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    apiKey: row.api_key,
    createdAt: row.created_at,
  }
}

export async function getProjectByApiKey(apiKey) {
  const { rows } = await query('select * from projects where api_key = $1', [apiKey])
  return rows[0] ? toDTO(rows[0]) : null
}

export async function getProjectById(id) {
  const { rows } = await query('select * from projects where id = $1', [id])
  return rows[0] ? toDTO(rows[0]) : null
}

export async function getProjectsByOwner(ownerId) {
  const { rows } = await query('select * from projects where owner_id = $1 order by created_at', [ownerId])
  return rows.map(toDTO)
}

export async function isOwnedBy(projectId, ownerId) {
  const { rows } = await query('select 1 from projects where id = $1 and owner_id = $2', [projectId, ownerId])
  return rows.length > 0
}

export async function createProject(ownerId, name, slug) {
  const { rows } = await query(
    'insert into projects (owner_id, name, slug) values ($1, $2, $3) returning *',
    [ownerId, name, slug]
  )
  return toDTO(rows[0])
}
