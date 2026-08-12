// The Rulebook — deterministic. The planner (mock or OpenAI) only proposes;
// this is the only thing that ever writes a rule to the store, and it never
// trusts the planner's word for anything that matters.

import { nanoid } from 'nanoid'
import { findAnchor } from './map.js'
import { addRule, findConflict, recordOutcome } from './store.js'
import { isLocked, lockReason } from './boundaries.js'

const ALLOWED_ACTIONS = ['hide', 'show', 'restyle', 'redirect']
const ALLOWED_STYLE_PROPS = ['fontSize', 'opacity', 'transform', 'maxWidth', 'width', 'padding', 'margin', 'order', 'filter']

export function commitProposal(userId, route, proposal, createdFrom) {
  if (!proposal || typeof proposal !== 'object') {
    recordOutcome('refused')
    return { refused: true, reason: "I couldn't work out a clean change from that." }
  }

  const { action, target, style, redirectTo } = proposal

  if (!ALLOWED_ACTIONS.includes(action)) {
    recordOutcome('refused')
    return { refused: true, reason: `"${action}" isn't a change I know how to make.` }
  }

  if (action === 'redirect') {
    if (!redirectTo || typeof redirectTo !== 'string') {
      recordOutcome('refused')
      return { refused: true, reason: 'I need a destination to redirect to.' }
    }
    const rule = buildRule(userId, route, { action, target: null, params: { redirectTo } }, createdFrom, null)
    addRule(userId, rule)
    recordOutcome('granted')
    return { rule }
  }

  if (!target) {
    recordOutcome('refused')
    return { refused: true, reason: 'I need to know which part of the page you mean.' }
  }

  // Never trust the planner's target — it must exist in the Map we hold,
  // not just be a plausible-sounding string.
  const anchor = findAnchor(route, target)
  if (!anchor) {
    recordOutcome('refused')
    return { refused: true, reason: "I couldn't find that part of the page." }
  }

  // The Map's own locked flag is just the starting default — the owner's
  // dashboard is the live source of truth, and it can lock or unlock any
  // anchor at any time without a redeploy.
  if (isLocked(anchor.id)) {
    recordOutcome('refused')
    return { refused: true, reason: lockReason(anchor.id) }
  }

  const conflict = findConflict(userId, route, target)
  if (conflict) {
    if (conflict.action === action) {
      recordOutcome('granted')
      return { rule: conflict, alreadyActive: true }
    }
    recordOutcome('clarified')
    return { conflict: { existing: conflict, anchorName: anchor.name } }
  }

  const safeStyle = {}
  if (action === 'restyle' && style && typeof style === 'object') {
    for (const [key, value] of Object.entries(style)) {
      if (ALLOWED_STYLE_PROPS.includes(key) && typeof value === 'string') {
        safeStyle[key] = value
      }
    }
  }

  const rule = buildRule(
    userId,
    route,
    { action, target, params: action === 'restyle' ? { style: safeStyle } : {} },
    createdFrom,
    anchor.name
  )
  addRule(userId, rule)
  recordOutcome('granted')
  return { rule }
}

function buildRule(userId, route, { action, target, params }, createdFrom, targetName) {
  return {
    id: nanoid(10),
    userId,
    when: { route },
    target,
    targetName,
    action,
    params,
    state: 'active',
    createdFrom,
    createdAt: new Date().toISOString(),
  }
}
