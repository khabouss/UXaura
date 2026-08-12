// The core engine. Knows nothing about rage clicks, dead clicks, or any
// other specific pattern — it just multiplexes DOM events to whichever
// triggers are registered, and calls onTrigger when one of them decides to
// fire. Add or remove triggers freely; this file has no opinion on what a
// trigger checks for.

// Events with no element target at all — window-level navigation signals,
// not something that happened to a specific node on the page.
const WINDOW_EVENTS = new Set(['popstate', 'hashchange', 'uxaura:navigation'])

export function createWatcher({ triggers = [], onTrigger } = {}) {
  const registered = new Map() // id -> trigger
  const listeners = new Map() // eventName -> { target, handler }

  function isOwnUI(el) {
    return Boolean(el && el.closest && el.closest('[data-uxa-ui]'))
  }

  function nearestAnchor(el) {
    const anchorEl = el && el.closest && el.closest('[data-uxa-id]')
    return anchorEl ? anchorEl.getAttribute('data-uxa-id') : null
  }

  // Mouse-ish events (click, mousemove, wheel) carry clientX/clientY.
  // Focus and form events don't — fall back to the target's own position
  // so a trigger fired from, say, a form field still anchors sensibly.
  function pointFor(e, el) {
    if (typeof e.clientX === 'number') return { x: e.clientX, y: e.clientY }
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    return { x: null, y: null }
  }

  function runTriggers(eventName, e, el) {
    const point = el ? pointFor(e, el) : { x: null, y: null }
    for (const trigger of registered.values()) {
      if (!trigger.events.includes(eventName)) continue
      trigger.handleEvent(e, {
        now: () => Date.now(),
        isOwnUI,
        fire: (detail) =>
          onTrigger({
            triggerId: trigger.id,
            anchorId: el ? nearestAnchor(el) : null,
            x: point.x,
            y: point.y,
            ...detail,
          }),
      })
    }
  }

  function dispatch(eventName, e) {
    if (WINDOW_EVENTS.has(eventName)) {
      runTriggers(eventName, e, null)
      return
    }
    const el = e.target
    if (!(el instanceof Element) || isOwnUI(el)) return
    runTriggers(eventName, e, el)
  }

  function ensureListener(eventName) {
    if (listeners.has(eventName)) return
    const target = WINDOW_EVENTS.has(eventName) ? window : document
    const handler = (e) => dispatch(eventName, e)
    target.addEventListener(eventName, handler)
    listeners.set(eventName, { target, handler })
  }

  function addTrigger(trigger) {
    registered.set(trigger.id, trigger)
    trigger.events.forEach(ensureListener)
  }

  function removeTrigger(id) {
    registered.delete(id)
  }

  triggers.forEach(addTrigger)

  function stop() {
    listeners.forEach(({ target, handler }, eventName) => target.removeEventListener(eventName, handler))
    listeners.clear()
    registered.clear()
  }

  return { addTrigger, removeTrigger, stop }
}
