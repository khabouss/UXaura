// The Rulebook — deterministic. The planner (mock or OpenAI) only proposes;
// this is the only thing that ever writes a rule to the store, and it never
// trusts the planner's word for anything that matters.

import { findAnchor } from './anchors.js'
import { addRule, findConflict, recordEvent } from './rules.js'

const ALLOWED_ACTIONS = ['hide', 'show', 'restyle', 'redirect']
const ALLOWED_STYLE_PROPS = ['fontSize', 'opacity', 'transform', 'maxWidth', 'width', 'padding', 'margin', 'order', 'filter']

export async function commitProposal(projectId, userId, route, proposal, createdFrom) {
  if (!proposal || typeof proposal !== 'object') {
    await recordEvent(projectId, 'refused', route)
    return { refused: true, reason: "I couldn't work out a clean change from that." }
  }

  const { action, target, style, redirectTo } = proposal

  if (!ALLOWED_ACTIONS.includes(action)) {
    await recordEvent(projectId, 'refused', route)
    return { refused: true, reason: `"${action}" isn't a change I know how to make.` }
  }

  if (action === 'redirect') {
    if (!redirectTo || typeof redirectTo !== 'string') {
      await recordEvent(projectId, 'refused', route)
      return { refused: true, reason: 'I need a destination to redirect to.' }
    }
    const rule = await addRule(projectId, userId, {
      route,
      target: null,
      action,
      params: { redirectTo },
      createdFrom,
    })
    await recordEvent(projectId, 'granted', route)
    return { rule }
  }

  if (!target) {
    await recordEvent(projectId, 'refused', route)
    return { refused: true, reason: 'I need to know which part of the page you mean.' }
  }

  // Never trust the planner's target — it must exist in the Map we hold,
  // not just be a plausible-sounding string.
  const anchor = await findAnchor(projectId, route, target)
  if (!anchor) {
    await recordEvent(projectId, 'refused', route)
    return { refused: true, reason: "I couldn't find that part of the page." }
  }

  // The owner's dashboard is the live source of truth for what's locked —
  // it can change at any time without a redeploy.
  if (anchor.locked) {
    await recordEvent(projectId, 'refused', route)
    return { refused: true, reason: anchor.lockReason }
  }

  const conflict = await findConflict(projectId, userId, route, target)
  if (conflict) {
    if (conflict.action === action) {
      await recordEvent(projectId, 'granted', route)
      return { rule: conflict, alreadyActive: true }
    }
    await recordEvent(projectId, 'clarified', route)
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

  const rule = await addRule(projectId, userId, {
    route,
    target,
    targetName: anchor.name,
    action,
    params: action === 'restyle' ? { style: safeStyle } : {},
    createdFrom,
  })
  await recordEvent(projectId, 'granted', route)
  return { rule }
}
