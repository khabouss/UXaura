import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { anchorsForRoute, MAP } from './map.js'
import { getRules, setRuleState, findRule, getCounters, getConversation, pushConversation } from './store.js'
import { commitProposal } from './rulebook.js'
import { planWithMockBrain } from './mockBrain.js'
import { planWithOpenAI } from './openaiBrain.js'
import { listBoundaries, setBoundary, isLocked, lockReason } from './boundaries.js'

const app = express()
app.use(cors())
app.use(express.json())

const usingOpenAI = Boolean(process.env.OPENAI_API_KEY)
console.log(
  usingOpenAI
    ? '[uxaura] Using the OpenAI brain.'
    : '[uxaura] No OPENAI_API_KEY set — using the mock keyword brain. See packages/server/.env.example.'
)

app.get('/api/health', (req, res) => {
  res.json({ ok: true, brain: usingOpenAI ? 'openai' : 'mock', counters: getCounters() })
})

app.get('/api/map', (req, res) => {
  res.json(MAP)
})

app.get('/api/rules', (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId is required' })
  res.json({ rules: getRules(userId) })
})

app.post('/api/rules/:id/toggle', (req, res) => {
  const { userId, active } = req.body
  if (!userId) return res.status(400).json({ error: 'userId is required' })
  const existing = findRule(userId, req.params.id)
  if (!existing) return res.status(404).json({ error: 'not found' })
  const rule = setRuleState(userId, req.params.id, active ? 'active' : 'off')
  res.json({ rule })
})

app.post('/api/chat', async (req, res) => {
  const { userId, route, message, clickedAnchor } = req.body
  if (!userId || !route || !message) {
    return res.status(400).json({ error: 'userId, route and message are required' })
  }

  // Merge in live boundary state — the planner's own view of what's locked
  // must match what the Rulebook will actually enforce, not the Map's
  // startup defaults, or the model ends up proposing things it can already
  // tell the owner has since locked.
  const anchors = anchorsForRoute(route).map((a) => ({
    ...a,
    locked: isLocked(a.id),
    lockReason: isLocked(a.id) ? lockReason(a.id) : undefined,
  }))
  const existingRules = getRules(userId).filter((r) => r.when.route === route && r.state === 'active')
  const history = getConversation(userId, route)

  // The click gets folded into the stored message text (not just passed as
  // a side channel) so that when this turn becomes history for the *next*
  // request, the model can still see what was pointed at.
  const userContent = clickedAnchor ? `(pointed at: ${clickedAnchor}) ${message}` : message

  try {
    const plan = usingOpenAI
      ? await planWithOpenAI({ message: userContent, route, clickedAnchor, anchors, existingRules, history })
      : planWithMockBrain({ message, route, clickedAnchor, anchors })

    let payload

    if (plan.reply) {
      payload = { reply: plan.reply }
    } else {
      const outcome = commitProposal(userId, route, plan.proposal, message)

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

    pushConversation(userId, route, 'user', userContent)
    pushConversation(userId, route, 'assistant', payload.reply)

    return res.json(payload)
  } catch (err) {
    console.error(err)
    res.status(500).json({ reply: 'Something went wrong on my end — try again in a moment.' })
  }
})

// The owner dashboard. No auth in this prototype — a real deployment gates
// this behind the customer's own admin login, never behind a shared secret
// baked into a public client.
app.get('/api/admin/boundaries', (req, res) => {
  res.json({ boundaries: listBoundaries() })
})

app.post('/api/admin/boundaries', (req, res) => {
  const { anchorId, locked, reason } = req.body
  if (!anchorId) return res.status(400).json({ error: 'anchorId is required' })
  const updated = setBoundary(anchorId, locked, reason)
  if (!updated) return res.status(404).json({ error: 'unknown anchor' })
  res.json({ boundary: updated })
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`[uxaura] server listening on http://localhost:${port}`)
})
