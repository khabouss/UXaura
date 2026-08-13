// The Map, extracted from real source — no attribute you have to add just
// for this. An anchor's key comes from whichever of these it already has:
// an explicit data-uxa-id (if you want a dedicated hook), a plain id (the
// common case — most elements worth pointing at already have one for other
// reasons), or data-testid (also usually already there). If an element has
// none of the three, it has no stable name to point at — that's not a
// scanner limitation, it's the same "names, not positions" rule Hands
// itself won't bend on.
//
// Route can't be inferred from an element's own markup without guessing —
// it comes from the small file → route map in uxaura.config.js instead, so
// nothing about the component's own code has to change at all.

import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'

const traverse = _traverse.default ?? _traverse

function humanize(key) {
  return key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getAttrValue(attributes, name) {
  const attr = attributes.find((a) => a.type === 'JSXAttribute' && a.name?.name === name)
  if (!attr || !attr.value) return null
  if (attr.value.type === 'StringLiteral') return attr.value.value
  return null // dynamic values ({expr}) aren't something a static scan can read
}

export function scanFile(filePath, route) {
  const code = readFileSync(filePath, 'utf8')
  const anchors = []
  const warnings = []

  let ast
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx'] })
  } catch (err) {
    warnings.push(`${filePath}: couldn't parse — ${err.message}`)
    return { anchors, warnings }
  }

  traverse(ast, {
    JSXOpeningElement(path) {
      const attributes = path.node.attributes
      const anchorKey =
        getAttrValue(attributes, 'data-uxa-id') ||
        getAttrValue(attributes, 'id') ||
        getAttrValue(attributes, 'data-testid')
      if (!anchorKey) return

      const name = getAttrValue(attributes, 'aria-label') || getAttrValue(attributes, 'data-uxa-name') || humanize(anchorKey)
      const description = getAttrValue(attributes, 'data-uxa-description') || getAttrValue(attributes, 'title') || ''

      anchors.push({ route, anchorKey, name, description, file: filePath })
    },
  })

  return { anchors, warnings }
}

// routeMap: { [absoluteFilePath]: route }
export function scan(routeMap) {
  const anchors = []
  const warnings = []
  const seen = new Map() // `${route}:${anchorKey}` -> file, to catch collisions

  for (const [filePath, route] of Object.entries(routeMap)) {
    const result = scanFile(filePath, route)
    for (const anchor of result.anchors) {
      const dupeKey = `${anchor.route}:${anchor.anchorKey}`
      if (seen.has(dupeKey)) {
        warnings.push(
          `Duplicate: "${anchor.anchorKey}" on route ${anchor.route} appears in both ${seen.get(dupeKey)} and ${anchor.file} — kept the first one`
        )
        continue
      }
      seen.set(dupeKey, anchor.file)
      anchors.push(anchor)
    }
    warnings.push(...result.warnings)
  }

  return { anchors, warnings }
}
