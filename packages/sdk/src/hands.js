// The Hands. Applies rules to the page. Decides nothing, runs no model,
// only ever touches elements it can find by name, never by position. If it
// can't find a target, it reports drift instead of guessing.
//
// A name can come from three places, tried in order: an explicit
// data-uxa-id (if you want a dedicated hook), a plain id (the common
// case — most apps already have these for other reasons), or
// data-testid (also usually already there). No attribute is UXaura-
// specific unless you want one to be.

export function findAnchorElement(key) {
  return (
    document.querySelector(`[data-uxa-id="${key}"]`) ||
    document.getElementById(key) ||
    document.querySelector(`[data-testid="${key}"]`)
  )
}

const originalCssText = new WeakMap()
let lastTouched = new Set()

export function applyRules(rules, route) {
  const missing = []

  // Reset everything the previous run touched, then reapply from scratch.
  // Simple and correct for a prototype; a production Hands would diff
  // instead of resetting every time.
  lastTouched.forEach((anchorId) => {
    const el = findAnchorElement(anchorId)
    if (el) resetElement(el)
  })
  lastTouched = new Set()

  const active = rules.filter((r) => r.state === 'active' && r.when.route === route)

  for (const rule of active) {
    if (rule.action === 'redirect') {
      if (window.location.pathname !== rule.params.redirectTo) {
        window.location.href = rule.params.redirectTo
      }
      continue
    }

    const el = findAnchorElement(rule.target)
    if (!el) {
      missing.push(rule)
      continue
    }

    captureOriginal(el)
    lastTouched.add(rule.target)

    if (rule.action === 'hide') {
      el.style.display = 'none'
    } else if (rule.action === 'show') {
      el.style.display = ''
    } else if (rule.action === 'restyle') {
      Object.assign(el.style, rule.params.style || {})
    }
  }

  if (missing.length > 0) {
    console.warn(
      '[uxaura] These rules point at parts of the page that no longer exist — drift:',
      missing.map((r) => `${r.action} ${r.target}`)
    )
  }

  return { missing }
}

function captureOriginal(el) {
  if (!originalCssText.has(el)) {
    originalCssText.set(el, el.style.cssText)
  }
}

function resetElement(el) {
  if (originalCssText.has(el)) {
    el.style.cssText = originalCssText.get(el)
  }
}
