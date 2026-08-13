#!/usr/bin/env node
import { globSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { scan } from './scan.js'

async function main() {
  const cwd = process.cwd()
  const configPath = path.join(cwd, 'uxaura.config.js')

  let config
  try {
    config = (await import(pathToFileURL(configPath).href)).default
  } catch {
    console.error(`[uxaura-scan] No uxaura.config.js found in ${cwd}`)
    console.error('[uxaura-scan] Expected: export default { include: ["src/**/*.jsx"] }')
    process.exitCode = 1
    return
  }

  const include = config.include ?? ['src/**/*.jsx']
  const files = include.flatMap((pattern) => [...globSync(pattern, { cwd })]).map((f) => path.join(cwd, f))

  if (files.length === 0) {
    console.error(`[uxaura-scan] No files matched ${JSON.stringify(include)}`)
    process.exitCode = 1
    return
  }

  console.log(`[uxaura-scan] Scanning ${files.length} file(s)…`)
  const { anchors, warnings } = scan(files)

  for (const w of warnings) console.warn(`[uxaura-scan] ⚠ ${w}`)

  if (anchors.length === 0) {
    console.log('[uxaura-scan] No tagged elements found — nothing to upload.')
    return
  }

  const apiUrl = process.env.UXAURA_API_URL
  const projectKey = process.env.UXAURA_PROJECT_KEY

  if (!apiUrl || !projectKey) {
    console.log(`[uxaura-scan] Found ${anchors.length} anchor(s). Set UXAURA_API_URL and UXAURA_PROJECT_KEY to upload:`)
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
    console.error(`[uxaura-scan] Upload failed: ${body.error || res.status}`)
    process.exitCode = 1
    return
  }

  const { created, updated } = await res.json()
  console.log(`[uxaura-scan] Done — ${created.length} new, ${updated.length} refreshed.`)
  if (created.length) console.log(`  new: ${created.join(', ')}`)
  if (updated.length) console.log(`  refreshed: ${updated.join(', ')}`)
}

main()
