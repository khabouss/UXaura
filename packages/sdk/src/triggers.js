// Built-in triggers. No AI anywhere in this file — every one of these is
// the same signal marketing/UX analytics tools (FullStory, Hotjar, and
// similar) already surface from session recordings: rage click, dead
// click, error click, thrashed cursor, exit intent, rage scroll, U-turn
// navigation, form abandonment. Each is a plain description of something
// the user did, decided from raw DOM events. Ship these, remove them, or
// write your own in the same shape — see createWatcher.js for the contract.

export function rageClickTrigger({
  id = 'rage-click',
  prompt = 'Is something wrong here?',
  count = 3,
  windowMs = 900,
  radius = 24,
  cooldownMs = 4000,
} = {}) {
  let recent = []
  let lastFireAt = 0

  return {
    id,
    events: ['click'],
    handleEvent(e, { fire, now }) {
      const t = now()
      recent = recent.filter((c) => t - c.t < windowMs)
      recent.push({ t, x: e.clientX, y: e.clientY })

      if (recent.length >= count && t - lastFireAt > cooldownMs) {
        const cluster = recent.slice(-count)
        const origin = cluster[0]
        const tight = cluster.every((c) => Math.hypot(c.x - origin.x, c.y - origin.y) < radius)
        if (tight) {
          lastFireAt = t
          recent = []
          fire({ prompt })
        }
      }
    },
  }
}

export function deadClickTrigger({
  id = 'dead-click',
  prompt = "That doesn't look clickable — were you expecting something?",
  checkDelayMs = 350,
  cooldownMs = 4000,
  interactiveSelector = 'a,button,input,select,textarea,label,[role="button"],[contenteditable="true"]',
} = {}) {
  let lastFireAt = 0
  let inFlight = false

  return {
    id,
    events: ['click'],
    handleEvent(e, { fire, now, isOwnUI }) {
      const el = e.target
      if (el.closest(interactiveSelector) || inFlight) return

      inFlight = true
      const initialPath = location.pathname
      const initialActive = document.activeElement
      let mutated = false

      const observer = new MutationObserver((records) => {
        const relevant = records.some((rec) => {
          const node = rec.target.nodeType === 1 ? rec.target : rec.target.parentElement
          return node && !isOwnUI(node)
        })
        if (relevant) mutated = true
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true })

      window.setTimeout(() => {
        observer.disconnect()
        inFlight = false
        const navigated = location.pathname !== initialPath
        const focusChanged = document.activeElement !== initialActive
        if (!mutated && !navigated && !focusChanged && now() - lastFireAt > cooldownMs) {
          lastFireAt = now()
          fire({ prompt })
        }
      }, checkDelayMs)
    },
  }
}

// A click that's followed almost immediately by a new error appearing on
// the page — a failed submit, a validation message, anything matching
// errorSelector. Counts elements before and after so it only fires when
// one is newly added, not just because an old error was already showing.
export function errorClickTrigger({
  id = 'error-click',
  prompt = "That didn't go through — want help?",
  errorSelector = '[aria-invalid="true"], [role="alert"], .error, .invalid',
  checkDelayMs = 400,
  cooldownMs = 5000,
} = {}) {
  let lastFireAt = 0

  return {
    id,
    events: ['click'],
    handleEvent(e, { fire, now, isOwnUI }) {
      const before = document.querySelectorAll(errorSelector).length

      window.setTimeout(() => {
        if (now() - lastFireAt <= cooldownMs) return
        const errorEls = [...document.querySelectorAll(errorSelector)].filter((el) => !isOwnUI(el))
        if (errorEls.length > before) {
          lastFireAt = now()
          fire({ prompt })
        }
      }, checkDelayMs)
    },
  }
}

// FullStory calls this a "thrashed cursor": the mouse moving erratically or
// in circles, usually while the person is confused or waiting. Detected by
// comparing how far the cursor actually traveled against how far it ended
// up from where it started — a scribble covers a lot of ground for very
// little net movement; a deliberate motion doesn't.
export function thrashedCursorTrigger({
  id = 'thrashed-cursor',
  prompt = 'Looking for something? I can help.',
  windowMs = 800,
  minPathLength = 400,
  ratioThreshold = 4,
  sampleEveryMs = 40,
  cooldownMs = 6000,
} = {}) {
  let points = []
  let lastSampleAt = 0
  let lastFireAt = 0

  return {
    id,
    events: ['mousemove'],
    handleEvent(e, { fire, now }) {
      const t = now()
      if (t - lastSampleAt < sampleEveryMs) return
      lastSampleAt = t

      points = points.filter((p) => t - p.t < windowMs)
      points.push({ t, x: e.clientX, y: e.clientY })
      if (points.length < 6 || t - lastFireAt <= cooldownMs) return

      let pathLength = 0
      for (let i = 1; i < points.length; i++) {
        pathLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
      }
      const first = points[0]
      const last = points[points.length - 1]
      const net = Math.hypot(last.x - first.x, last.y - first.y)

      if (pathLength > minPathLength && pathLength > net * ratioThreshold) {
        lastFireAt = t
        points = []
        fire({ prompt })
      }
    },
  }
}

// The classic exit-intent popup signal: the cursor makes a fast move off
// the top edge of the window, toward the tab bar or address bar. Fires at
// most once every `cooldownMs` — this one is meant to be rare, not a
// running commentary on every mouse movement.
export function exitIntentTrigger({
  id = 'exit-intent',
  prompt = 'Before you go — anything I can fix?',
  edgeThreshold = 20,
  cooldownMs = 30000,
} = {}) {
  let lastFireAt = 0
  let lastY = null

  return {
    id,
    events: ['mousemove', 'mouseout'],
    handleEvent(e, { fire, now }) {
      if (e.type === 'mousemove') {
        lastY = e.clientY
        return
      }
      const t = now()
      if (t - lastFireAt <= cooldownMs) return
      const leftWindow = !e.relatedTarget
      const leavingTop = e.clientY <= edgeThreshold && (lastY === null || e.clientY <= lastY)
      if (leftWindow && leavingTop) {
        lastFireAt = t
        fire({ prompt })
      }
    },
  }
}

// Scrolling up and down repeatedly, reversing direction again and again —
// the "I know it's here somewhere" pattern. Counted on wheel events so
// direction is read straight off the gesture rather than inferred from
// scroll position (which trackpads and momentum scrolling make noisy).
export function rageScrollTrigger({
  id = 'rage-scroll',
  prompt = 'Not finding what you need? Ask me.',
  reversals = 4,
  windowMs = 2500,
  cooldownMs = 6000,
} = {}) {
  let history = []
  let lastFireAt = 0

  return {
    id,
    events: ['wheel'],
    handleEvent(e, { fire, now }) {
      const t = now()
      const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0
      if (dir === 0) return

      history = history.filter((h) => t - h.t < windowMs)
      const lastDir = history.length ? history[history.length - 1].dir : null
      history.push({ t, dir, reversal: lastDir !== null && dir !== lastDir })

      const reversalCount = history.filter((h) => h.reversal).length
      if (reversalCount >= reversals && t - lastFireAt > cooldownMs) {
        lastFireAt = t
        history = []
        fire({ prompt })
      }
    },
  }
}

// Hotjar's "U-turn": navigate away from a page and come straight back,
// quickly — usually a sign the destination wasn't what was expected.
// Covers the back/forward buttons (popstate), hash-based routers
// (hashchange), and ordinary SPA router navigation via pushState/
// replaceState, which don't fire a native event on their own — so this
// patches those two methods once, the first time a U-turn trigger is
// created, and dispatches a matching window event whenever they're called.
let historyPatched = false
function ensureHistoryEventsPatched() {
  if (historyPatched || typeof window === 'undefined') return
  historyPatched = true
  ;['pushState', 'replaceState'].forEach((method) => {
    const original = history[method]
    history[method] = function (...args) {
      const result = original.apply(this, args)
      window.dispatchEvent(new Event('uxaura:navigation'))
      return result
    }
  })
}

export function uTurnTrigger({
  id = 'u-turn',
  prompt = 'Trouble finding your way back?',
  withinMs = 6000,
  cooldownMs = 15000,
} = {}) {
  ensureHistoryEventsPatched()

  function currentPath() {
    return location.pathname + location.hash
  }

  // Seeded now, at creation — not lazily on the first event. By the time a
  // navigation event fires, history/location has already changed, so
  // capturing "where we started" has to happen before that.
  let history = [{ t: Date.now(), path: currentPath() }]
  let lastFireAt = 0

  return {
    id,
    events: ['popstate', 'hashchange', 'uxaura:navigation'],
    handleEvent(_e, { fire, now }) {
      const t = now()
      const path = currentPath()
      history = history.filter((h) => t - h.t < withinMs)
      if (history[history.length - 1]?.path !== path) {
        history.push({ t, path })
      }
      if (history.length >= 3 && t - lastFireAt > cooldownMs) {
        const [a, b, c] = history.slice(-3)
        if (a.path === c.path && a.path !== b.path) {
          lastFireAt = t
          fire({ prompt })
        }
      }
    },
  }
}

// A field gets focused, then the form is left — blurred, and nothing else
// in it gets focus, and it's never submitted. The quintessential newsletter-
// signup / checkout-field abandonment signal.
export function formAbandonTrigger({
  id = 'form-abandon',
  prompt = 'Got stuck on this? I can help.',
  fieldSelector = 'input,textarea,select',
  abandonMs = 5000,
  cooldownMs = 8000,
} = {}) {
  let lastFireAt = 0
  const timers = new WeakMap()
  const submittedForms = new WeakSet()

  return {
    id,
    events: ['focusin', 'focusout', 'submit'],
    handleEvent(e, { fire, now }) {
      const form = e.target.closest && e.target.closest('form')
      if (!form) return

      if (e.type === 'submit') {
        submittedForms.add(form)
        const existing = timers.get(form)
        if (existing) window.clearTimeout(existing)
        return
      }

      if (!e.target.matches || !e.target.matches(fieldSelector)) return

      if (e.type === 'focusin') {
        submittedForms.delete(form)
        const existing = timers.get(form)
        if (existing) window.clearTimeout(existing)
      }

      if (e.type === 'focusout') {
        const timer = window.setTimeout(() => {
          const stillOutside = !form.contains(document.activeElement)
          if (!submittedForms.has(form) && stillOutside && now() - lastFireAt > cooldownMs) {
            lastFireAt = now()
            fire({ prompt })
          }
        }, abandonMs)
        timers.set(form, timer)
      }
    },
  }
}
