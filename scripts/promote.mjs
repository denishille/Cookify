#!/usr/bin/env node
// Verschiebt Rezepte zwischen Backlog (src/data/backlog, nicht in der App) und Live-Bestand (src/data/recipes/live.json).
//
//   node scripts/promote.mjs m-wiener-schnitzel v-linsen-dal      # ins Live-Set holen
//   node scripts/promote.mjs --back d-tiramisu                      # zurück ins Backlog
//   node scripts/promote.mjs --list                                 # Live-Rezepte anzeigen
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backlogDir = join(root, 'src/data/backlog')
const liveFile = join(root, 'src/data/recipes/live.json')

const args = process.argv.slice(2)
const back = args.includes('--back')
const ids = args.filter((a) => !a.startsWith('--'))
const live = existsSync(liveFile) ? JSON.parse(readFileSync(liveFile, 'utf8')) : []

if (args.includes('--list')) {
  for (const r of live) console.log(`${r.id}  ${r.title}`)
  console.log(`${live.length} live`)
  process.exit(0)
}
if (ids.length === 0) { console.log('Keine IDs angegeben.'); process.exit(1) }

const files = readdirSync(backlogDir).filter((f) => f.endsWith('.json')).map((f) => ({ path: join(backlogDir, f), data: JSON.parse(readFileSync(join(backlogDir, f), 'utf8')) }))
const save = (f) => writeFileSync(f.path, JSON.stringify(f.data, null, 2) + '\n')

for (const id of ids) {
  if (back) {
    const i = live.findIndex((r) => r.id === id)
    if (i < 0) { console.log(`– ${id}: nicht live`); continue }
    const [r] = live.splice(i, 1)
    const target = files.find((f) => f.path.endsWith('/part' + ({ m: 1, v: 2, d: 3, s: 4, w: 5 }[id[0]] ?? 5) + '.json')) ?? files[0]
    target.data.push(r); save(target)
    console.log(`↩ ${id} → Backlog`)
  } else {
    if (live.some((r) => r.id === id)) { console.log(`– ${id}: schon live`); continue }
    const f = files.find((f) => f.data.some((r) => r.id === id))
    if (!f) { console.log(`– ${id}: nicht im Backlog`); continue }
    const i = f.data.findIndex((r) => r.id === id)
    live.push(f.data.splice(i, 1)[0]); save(f)
    console.log(`✓ ${id} → live`)
  }
}
writeFileSync(liveFile, JSON.stringify(live, null, 2) + '\n')
console.log(`${live.length} Rezepte live, Backlog: ${files.reduce((a, f) => a + f.data.length, 0)}`)
