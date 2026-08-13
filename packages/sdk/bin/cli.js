#!/usr/bin/env node
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { scan } from './scan.js'

const [, , subcommand] = process.argv

if (subcommand !== 'scan') {
  console.error('Usage: uxaura scan')
  process.exitCode = 1
} else {
  await runScan()
}

async function runScan() {
  const cwd = process.cwd()
  const configPath = path.join(cwd, 'uxaura.config.js')

  let config
  try {
    config = (await import(pathToFileURL(configPath).href)).default
  } catch {
    console.error(`[uxaura] No uxaura.config.js found in ${cwd}`)
    console.error('[uxaura] Expected: export default { routes: { "src/pages/Home.jsx": "/" } }')
    process.exitCode = 1
    return
  }

  const routes = config.routes ?? {}
  const routeMap = Object.fromEntries(Object.entries(routes).map(([file, route]) => [path.join(cwd, file), route]))

  if (Object.keys(routeMap).length === 0) {
    console.error('[uxaura] uxaura.config.js has no routes configured.')
    process.exitCode = 1
    return
  }

  console.log(`[uxaura] Scanning ${Object.keys(routeMap).length} file(s)…`)
  const { anchors, warnings } = scan(routeMap)

  for (const w of warnings) console.warn(`[uxaura] ⚠ ${w}`)

  if (anchors.length === 0) {
    console.log('[uxaura] No named elements found (id, data-testid, or data-uxa-id) — nothing to upload.')
    return
  }

  const apiUrl = process.env.UXAURA_API_URL
  const projectKey = process.env.UXAURA_PROJECT_KEY

  if (!apiUrl || !projectKey) {
    console.log(`[uxaura] Found ${anchors.length} anchor(s). Set UXAURA_API_URL and UXAURA_PROJECT_KEY to upload:`)
    for (const a of anchors) console.log(`  ${a.route}  ${a.anchorKey}  — ${a.name}`)
    return
  }

  const res = await fetch(`${apiUrl}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-uxaura-project-key': projectKey },
    body: JSON.stringify({
      anchors: anchors.map(({ route, anchorKey, name, description }) => ({ route, anchorKey, name, description })),
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.error(`[uxaura] Upload failed: ${body.error || res.status}`)
    process.exitCode = 1
    return
  }

  const { created, updated } = await res.json()
  console.log(`[uxaura] Done — ${created.length} new, ${updated.length} refreshed.`)
  if (created.length) console.log(`  new: ${created.join(', ')}`)
  if (updated.length) console.log(`  refreshed: ${updated.join(', ')}`)
}
