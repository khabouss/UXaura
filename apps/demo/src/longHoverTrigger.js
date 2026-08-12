// Written by the host app, not the SDK — proves a dev can define an
// entirely new kind of trigger (a different event type, a different
// detection strategy) and it just works alongside the built-ins.
export function longHoverTrigger({ id = 'long-hover', prompt = 'Need a hand with this?', hoverMs = 1200 } = {}) {
  let timer = null
  let currentTarget = null

  return {
    id,
    events: ['mouseover', 'mouseout'],
    handleEvent(e, { fire }) {
      if (e.type === 'mouseover') {
        currentTarget = e.target
        window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          if (currentTarget === e.target) fire({ prompt })
        }, hoverMs)
      } else {
        window.clearTimeout(timer)
      }
    },
  }
}
