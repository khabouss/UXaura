// The keyword fallback. Used when OPENAI_API_KEY isn't set, so the whole
// prototype runs with zero setup. Deliberately dumb — it only has to prove
// the loop, not be a good planner.

const HIDE_WORDS = ['hide', 'remove', 'get rid of', 'collapse', 'close']
const SHOW_WORDS = ['show', 'bring back', 'restore', 'unhide', 'reveal']
const BIGGER_WORDS = ['bigger', 'larger', 'enlarge', 'increase']
const SMALLER_WORDS = ['smaller', 'shrink', 'reduce', 'decrease']

export function planWithMockBrain({ message, clickedAnchor, anchors }) {
  const text = message.toLowerCase()

  let target = clickedAnchor || null

  if (!target) {
    const candidates = anchors.filter((a) => {
      const name = a.name.toLowerCase()
      if (text.includes(name)) return true
      return name.split(' ').some((word) => word.length > 3 && text.includes(word))
    })
    if (candidates.length === 1) {
      target = candidates[0].key
    } else if (candidates.length > 1) {
      return {
        reply: `Which one did you mean — ${candidates.map((c) => c.name).join(', ')}? You can also switch on "point at it" and click the one you mean.`,
      }
    }
  }

  if (!target) {
    return {
      reply: "I'm not sure which part of the page you mean. Try clicking it with \"point at it\", or name it more specifically.",
    }
  }

  let action = null
  let style = null
  if (HIDE_WORDS.some((w) => text.includes(w))) {
    action = 'hide'
  } else if (SHOW_WORDS.some((w) => text.includes(w))) {
    action = 'show'
  } else if (BIGGER_WORDS.some((w) => text.includes(w))) {
    action = 'restyle'
    style = { fontSize: '1.4em' }
  } else if (SMALLER_WORDS.some((w) => text.includes(w))) {
    action = 'restyle'
    style = { fontSize: '0.85em' }
  }

  if (!action) {
    return {
      reply: 'I can hide, show, or resize things right now. What would you like to do to it?',
    }
  }

  return { proposal: { action, target, style } }
}
