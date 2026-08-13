// The Map, extracted from real source. Deliberately narrow for a first
// pass: it doesn't infer anything about your app's structure or trace which
// route renders which component (that's a much harder, much more fragile
// problem) — it just reads the same convention a developer already writes
// by hand: data-uxa-id on an element, data-uxa-route saying where it lives.
// A component reused across routes just carries its own route (or, if the
// dev tags it per usage site, one route per call site).

import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'

const traverse = _traverse.default ?? _traverse

function humanize(key) {
  return key
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getAttrValue(attributes, name) {
  const attr = attributes.find((a) => a.type === 'JSXAttribute' && a.name?.name === name)
  if (!attr || !attr.value) return null
  if (attr.value.type === 'StringLiteral') return attr.value.value
  return null // dynamic values ({expr}) aren't something a static scan can read
}

export function scanFile(filePath) {
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
      const anchorKey = getAttrValue(attributes, 'data-uxa-id')
      if (!anchorKey) return

      const route = getAttrValue(attributes, 'data-uxa-route')
      if (!route) {
        warnings.push(`${filePath}: "${anchorKey}" has data-uxa-id but no data-uxa-route — skipped`)
        return
      }

      const name = getAttrValue(attributes, 'data-uxa-name') || humanize(anchorKey)
      const description = getAttrValue(attributes, 'data-uxa-description') || ''

      anchors.push({ route, anchorKey, name, description, file: filePath })
    },
  })

  return { anchors, warnings }
}

export function scan(filePaths) {
  const anchors = []
  const warnings = []
  const seen = new Map() // `${route}:${anchorKey}` -> file, to catch collisions

  for (const filePath of filePaths) {
    const result = scanFile(filePath)
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
