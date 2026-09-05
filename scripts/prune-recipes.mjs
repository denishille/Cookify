#!/usr/bin/env node
// Entfernt Rezepte aus der App: schlecht bewertete (< 4,0), Platzhalterbilder, Duplikate.
// Aufruf: node scripts/prune-recipes.mjs id1 id2 …   |   --below 4   (alle unter Bewertung X)
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const recipesDir = join(root, 'src/data/recipes')
const sourcesDir = join(root, 'src/data/sources')
const assetsDir = join(root, 'src/assets/recipes')

const args = process.argv.slice(2)
const belowIdx = args.indexOf('--below')
const below = belowIdx >= 0 ? Number(args[belowIdx + 1]) : null
const ids = new Set(args.filter((a) => !a.startsWith('--') && a !== String(below)))

const sourceFiles = readdirSync(sourcesDir).filter((f) => f.endsWith('.json')).map((f) => ({ path: join(sourcesDir, f), data: JSON.parse(readFileSync(join(sourcesDir, f), 'utf8')) }))
const sources = Object.assign({}, ...sourceFiles.map((f) => f.data))

if (below !== null) {
  for (const [id, s] of Object.entries(sources)) if (typeof s?.rating === 'number' && s.rating < below) ids.add(id)
  // Rezepte, die ihre Quelle direkt mitbringen (Import aus HelloFresh/KptnCook)
  for (const f of readdirSync(recipesDir).filter((f) => f.endsWith('.json'))) {
    for (const r of JSON.parse(readFileSync(join(recipesDir, f), 'utf8'))) {
      if (typeof r.source?.rating === 'number' && r.source.rating < below) ids.add(r.id)
    }
  }
}
if (ids.size === 0) { console.log('Nichts zu entfernen.'); process.exit(0) }

let removed = 0
for (const f of readdirSync(recipesDir).filter((f) => f.endsWith('.json'))) {
  const p = join(recipesDir, f)
  const data = JSON.parse(readFileSync(p, 'utf8'))
  const keep = data.filter((r) => !ids.has(r.id))
  if (keep.length !== data.length) { writeFileSync(p, JSON.stringify(keep, null, 2) + '\n'); removed += data.length - keep.length }
}
for (const f of sourceFiles) {
  let n = 0
  for (const id of ids) if (id in f.data) { delete f.data[id]; n++ }
  if (n) writeFileSync(f.path, JSON.stringify(f.data, null, 2) + '\n')
}
for (const id of ids) { const img = join(assetsDir, `${id}.jpg`); if (existsSync(img)) unlinkSync(img) }
console.log(`${removed} Rezepte entfernt (${ids.size} IDs), Bilder und Quellen mit gelöscht.`)
