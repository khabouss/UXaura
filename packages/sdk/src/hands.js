// The Hands. Applies rules to the page. Decides nothing, runs no model,
// only ever touches elements it can find by name (data-uxa-id), never by
// position. If it can't find a target, it reports drift instead of guessing.

const originalCssText = new WeakMap()
let lastTouched = new Set()

export function applyRules(rules, route) {
  const missing = []

  // Reset everything the previous run touched, then reapply from scratch.
  // Simple and correct for a prototype; a production Hands would diff
  // instead of resetting every time.
  lastTouched.forEach((anchorId) => {
    const el = document.querySelector(`[data-uxa-id="${anchorId}"]`)
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

    const el = document.querySelector(`[data-uxa-id="${rule.target}"]`)
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
