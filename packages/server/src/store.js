// The Rules — everyone's settings, in memory, keyed by user id.
// A real deployment puts this in Postgres and pushes changes over a
// websocket. This is the same shape, minus persistence and live push.

const rulesByUser = new Map() // userId -> Rule[]
const counters = { granted: 0, refused: 0, clarified: 0 }

// Short-lived conversation memory, per user per route. Without this, "yes"
// in reply to a clarifying question means nothing — each /api/chat call
// would otherwise be planned from scratch with no idea what "yes" answers.
const conversations = new Map() // `${userId}:${route}` -> {role, content}[]
const MAX_HISTORY = 8 // messages (4 exchanges), enough for one back-and-forth

export function getConversation(userId, route) {
  return conversations.get(`${userId}:${route}`) ?? []
}

export function pushConversation(userId, route, role, content) {
  const key = `${userId}:${route}`
  const list = conversations.get(key) ?? []
  list.push({ role, content })
  while (list.length > MAX_HISTORY) list.shift()
  conversations.set(key, list)
}

export function getRules(userId) {
  return rulesByUser.get(userId) ?? []
}

export function getActiveRules(userId, route) {
  return getRules(userId).filter((r) => r.state === 'active' && r.when.route === route)
}

export function addRule(userId, rule) {
  const list = rulesByUser.get(userId) ?? []
  list.push(rule)
  rulesByUser.set(userId, list)
  return rule
}

export function findRule(userId, ruleId) {
  return getRules(userId).find((r) => r.id === ruleId)
}

export function setRuleState(userId, ruleId, state) {
  const rule = findRule(userId, ruleId)
  if (rule) rule.state = state
  return rule
}

// Existing active rule for the same target+route, regardless of action —
// this is what lets the planner notice "you already touched this thing."
export function findConflict(userId, route, target) {
  return getRules(userId).find(
    (r) => r.state === 'active' && r.when.route === route && r.target === target
  )
}

export function recordOutcome(kind) {
  if (kind in counters) counters[kind] += 1
}

export function getCounters() {
  return { ...counters }
}
