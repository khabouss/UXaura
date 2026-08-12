export function humanize(id) {
  return id.replace(/-/g, ' ')
}

// Past-tense state, for "Changes on this page" rows: "Hero carousel — Hidden"
export function verbLabel(action) {
  return { hide: 'Hidden', show: 'Shown', restyle: 'Restyled', redirect: 'Redirects' }[action] || action
}

// Past-tense verb, for the banner: "You hid the hero carousel"
export function pastTenseVerb(action) {
  return { hide: 'hid', show: 'showed', restyle: 'restyled', redirect: 'set a redirect for' }[action] || 'changed'
}
