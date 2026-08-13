import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { supabaseAdmin } from './db.js'
import { getProjectByApiKey, getProjectById, getProjectsByOwner, isOwnedBy, createProject } from './projects.js'
import { listAnchorsForRoute, listAllAnchors, createAnchor, setBoundary, bulkUpsertAnchors } from './anchors.js'
import { getRules, setRuleState, findRule, getCounters } from './rules.js'
import { getConversation, pushConversation } from './store.js'
import { commitProposal } from './rulebook.js'
import { planWithMockBrain } from './mockBrain.js'
import { planWithOpenAI } from './openaiBrain.js'
import { listToolsForProject, findToolBySlug, createTool, setToolEnabled, invokeTool } from './tools.js'

const app = express()
app.use(express.json())

// Dashboard/admin routes are only ever called from our own dashboard, so
// their origin is locked down. SDK routes (map/rules/chat/scan) are embedded
// on arbitrary customer sites we can't allow-list in advance — those stay
// open and rely on the project api_key for auth instead of CORS.
const dashboardOrigins = (process.env.DASHBOARD_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)
const dashboardCors = cors({ origin: dashboardOrigins })
const openCors = cors()

app.use(['/api/projects', '/api/admin'], dashboardCors)
app.use(['/api/health', '/api/map', '/api/scan', '/api/rules', '/api/chat'], openCors)

const usingOpenAI = Boolean(process.env.OPENAI_API_KEY)
console.log(
  usingOpenAI
    ? '[uxaura] Using the OpenAI brain.'
    : '[uxaura] No OPENAI_API_KEY set — using the mock keyword brain. See packages/server/.env.example.'
)

// ---- SDK-facing auth: a project's own api_key, sent by the SDK ----
async function resolveProject(req, res, next) {
  const key = req.header('x-uxaura-project-key')
  if (!key) return res.status(401).json({ error: 'x-uxaura-project-key header is required' })
  const project = await getProjectByApiKey(key)
  if (!project) return res.status(401).json({ error: 'unknown project key' })
  req.project = project
  next()
}

// ---- Dashboard-facing auth: the owner's Supabase session token ----
async function requireOwner(req, res, next) {
  const authHeader = req.header('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'missing bearer token' })
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'invalid session' })
  req.ownerId = data.user.id
  next()
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, brain: usingOpenAI ? 'openai' : 'mock' })
})

// ---- Project management (dashboard) ----

app.get('/api/projects', requireOwner, async (req, res) => {
  res.json({ projects: await getProjectsByOwner(req.ownerId) })
})

app.post('/api/projects', requireOwner, async (req, res) => {
  const { name, slug } = req.body
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' })
  try {
    const project = await createProject(req.ownerId, name, slug)
    res.json({ project })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'that slug is already taken' })
    console.error(err)
    res.status(500).json({ error: 'could not create project' })
  }
})

// ---- Anchors / Boundaries (dashboard) ----

app.get('/api/admin/anchors', requireOwner, async (req, res) => {
  const { projectId } = req.query
  if (!projectId) return res.status(400).json({ error: 'projectId is required' })
  if (!(await isOwnedBy(projectId, req.ownerId))) return res.status(403).json({ error: 'not your project' })
  const anchors = await listAllAnchors(projectId)
  res.json({ boundaries: anchors.map((a) => ({ anchorId: a.key, ...a, reason: a.lockReason })) })
})

app.post('/api/admin/anchors', requireOwner, async (req, res) => {
  const { projectId, route, anchorKey, name, description } = req.body
  if (!projectId || !route || !anchorKey || !name) {
    return res.status(400).json({ error: 'projectId, route, anchorKey and name are required' })
  }
  if (!(await isOwnedBy(projectId, req.ownerId))) return res.status(403).json({ error: 'not your project' })
  const anchor = await createAnchor(projectId, { route, anchorKey, name, description })
  res.json({ anchor })
})

app.post('/api/admin/boundaries', requireOwner, async (req, res) => {
  const { projectId, route, anchorId, locked, reason } = req.body
  if (!projectId || !route || !anchorId) {
    return res.status(400).json({ error: 'projectId, route and anchorId are required' })
  }
  if (!(await isOwnedBy(projectId, req.ownerId))) return res.status(403).json({ error: 'not your project' })
  const updated = await setBoundary(projectId, route, anchorId, locked, reason)
  if (!updated) return res.status(404).json({ error: 'unknown anchor' })
  res.json({ boundary: { anchorId: updated.key, ...updated, reason: updated.lockReason } })
})

app.get('/api/admin/reports', requireOwner, async (req, res) => {
  const { projectId } = req.query
  if (!projectId) return res.status(400).json({ error: 'projectId is required' })
  if (!(await isOwnedBy(projectId, req.ownerId))) return res.status(403).json({ error: 'not your project' })
  res.json({ counters: await getCounters(projectId) })
})

// ---- Backend tools (dashboard) ----

app.get('/api/admin/tools', requireOwner, async (req, res) => {
  const { projectId } = req.query
  if (!projectId) return res.status(400).json({ error: 'projectId is required' })
  if (!(await isOwnedBy(projectId, req.ownerId))) return res.status(403).json({ error: 'not your project' })
  res.json({ tools: await listToolsForProject(projectId) })
})

app.post('/api/admin/tools', requireOwner, async (req, res) => {
  const { projectId, slug, name, description, endpointUrl, inputSchema } = req.body
  if (!projectId || !slug || !name || !endpointUrl) {
    return res.status(400).json({ error: 'projectId, slug, name and endpointUrl are required' })
  }
  if (!(await isOwnedBy(projectId, req.ownerId))) return res.status(403).json({ error: 'not your project' })
  let schema
  try {
    schema = typeof inputSchema === 'string' ? JSON.parse(inputSchema || '{}') : inputSchema
  } catch {
    return res.status(400).json({ error: 'inputSchema must be valid JSON' })
  }
  const tool = await createTool(projectId, { slug, name, description, endpointUrl, inputSchema: schema })
  res.json({ tool })
})

app.post('/api/admin/tools/:id/toggle', requireOwner, async (req, res) => {
  const { projectId, enabled } = req.body
  if (!projectId) return res.status(400).json({ error: 'projectId is required' })
  if (!(await isOwnedBy(projectId, req.ownerId))) return res.status(403).json({ error: 'not your project' })
  const tool = await setToolEnabled(projectId, req.params.id, enabled)
  if (!tool) return res.status(404).json({ error: 'not found' })
  res.json({ tool })
})

// ---- SDK-facing routes ----

app.get('/api/map', resolveProject, async (req, res) => {
  const anchors = await listAllAnchors(req.project.id)
  const routes = {}
  for (const a of anchors) {
    routes[a.route] ??= { anchors: [] }
    routes[a.route].anchors.push({ id: a.key, name: a.name, description: a.description })
  }
  res.json({ appId: req.project.slug, buildId: req.project.id, routes })
})

// Build-time scanner upload. Same project-key auth as the SDK routes — a CI
// job authenticates the same lightweight way the browser does, no owner
// login needed. Never deletes or unlocks anything; only adds or refreshes
// names/descriptions for anchors the scan actually found.
app.post('/api/scan', resolveProject, async (req, res) => {
  const { anchors } = req.body
  if (!Array.isArray(anchors)) return res.status(400).json({ error: 'anchors must be an array' })
  for (const a of anchors) {
    if (!a.route || !a.anchorKey || !a.name) {
      return res.status(400).json({ error: 'each anchor needs route, anchorKey and name' })
    }
  }
  const { created, updated } = await bulkUpsertAnchors(req.project.id, anchors)
  res.json({
    created: created.map((a) => a.key),
    updated: updated.map((a) => a.key),
  })
})

app.get('/api/rules', resolveProject, async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId is required' })
  res.json({ rules: await getRules(req.project.id, userId) })
})

app.post('/api/rules/:id/toggle', resolveProject, async (req, res) => {
  const { userId, active } = req.body
  if (!userId) return res.status(400).json({ error: 'userId is required' })
  const existing = await findRule(req.project.id, req.params.id)
  if (!existing) return res.status(404).json({ error: 'not found' })
  const rule = await setRuleState(req.project.id, req.params.id, active ? 'active' : 'off')
  res.json({ rule })
})

app.post('/api/chat', resolveProject, async (req, res) => {
  const { userId, route, message, clickedAnchor } = req.body
  if (!userId || !route || !message) {
    return res.status(400).json({ error: 'userId, route and message are required' })
  }

  const projectId = req.project.id
  const rawAnchors = await listAnchorsForRoute(projectId, route)
  const anchors = rawAnchors // already {key, name, description, locked, lockReason}
  const existingRules = await getRules(projectId, userId).then((rules) =>
    rules.filter((r) => r.when.route === route && r.state === 'active')
  )
  const tools = usingOpenAI ? await listToolsForProject(projectId, { enabledOnly: true }) : []
  const history = getConversation(projectId, userId, route)
  const userContent = clickedAnchor ? `(pointed at: ${clickedAnchor}) ${message}` : message

  try {
    const plan = usingOpenAI
      ? await planWithOpenAI({ message: userContent, route, clickedAnchor, anchors, existingRules, history, tools })
      : planWithMockBrain({ message, route, clickedAnchor, anchors })

    let payload

    if (plan.reply) {
      payload = { reply: plan.reply }
    } else if (plan.toolCall) {
      // Re-check the tool is still enabled — the owner may have flipped it
      // off in the dashboard since this list of tools was fetched.
      const tool = await findToolBySlug(projectId, plan.toolCall.slug)
      if (!tool || !tool.enabled) {
        payload = { reply: "That's not available right now.", refused: true }
      } else {
        const result = await invokeTool(tool, plan.toolCall.args, { userId, route, project: req.project })
        payload = { reply: result.message, toolCall: { slug: tool.slug, ok: result.ok } }
      }
    } else {
      const outcome = await commitProposal(projectId, userId, route, plan.proposal, message)

      if (outcome.rule) {
        const verbs = { hide: 'hid', show: 'showed', restyle: 'changed', redirect: 'set a redirect for' }
        const verb = verbs[outcome.rule.action] || 'changed'
        const subject = outcome.rule.targetName || 'that'
        payload = {
          reply: outcome.alreadyActive ? `That's already set — no change needed.` : `Done — I ${verb} the ${subject}.`,
          rule: outcome.rule,
          alreadyActive: Boolean(outcome.alreadyActive),
        }
      } else if (outcome.conflict) {
        payload = {
          reply: `You already have a rule for the ${outcome.conflict.anchorName} (${outcome.conflict.existing.action}). Want me to undo that first?`,
          conflict: outcome.conflict,
        }
      } else {
        payload = { reply: outcome.reason, refused: true, reason: outcome.reason }
      }
    }

    pushConversation(projectId, userId, route, 'user', userContent)
    pushConversation(projectId, userId, route, 'assistant', payload.reply)

    return res.json(payload)
  } catch (err) {
    console.error(err)
    res.status(500).json({ reply: 'Something went wrong on my end — try again in a moment.' })
  }
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`[uxaura] server listening on http://localhost:${port}`)
})
