// What's left of the old in-memory store, on purpose: conversation memory
// is genuinely short-lived and doesn't need to survive a restart. Rules,
// anchors/boundaries, and event counts are all DB-backed now — see
// rules.js and anchors.js.

const conversations = new Map() // `${projectId}:${userId}:${route}` -> {role, content}[]
const MAX_HISTORY = 8

export function getConversation(projectId, userId, route) {
  return conversations.get(`${projectId}:${userId}:${route}`) ?? []
}

export function pushConversation(projectId, userId, route, role, content) {
  const key = `${projectId}:${userId}:${route}`
  const list = conversations.get(key) ?? []
  list.push({ role, content })
  while (list.length > MAX_HISTORY) list.shift()
  conversations.set(key, list)
}
