#!/usr/bin/env node
// Sucht Platzhalter- und Logobilder im Bildbestand: bekannte Platzhalter, flache Grafiken
// und Bilder, die mehrfach vorkommen (ein Foto pro Rezept, alles andere ist ein Platzhalter).
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { dhash, hamming, placeholderReason } from './lib/image-check.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(root, 'src/assets/recipes')
const recipeDirs = [join(root, 'src/data/recipes'), join(root, 'src/data/backlog')]
const importsDir = join(root, 'src/data/imports')
const files = readdirSync(assetsDir).filter((f) => f.endsWith('.jpg')).sort()

// Auch Entwürfe im Backlog zählen: deren Bilder sind schon geholt, das Rezept kommt später.
const ids = new Set(recipeDirs.flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).map((r) => r.id))))
// Entwürfe, die noch auf ihr Rezept warten: ihr Bild ist schon da und in Ordnung.
if (existsSync(importsDir)) for (const f of readdirSync(importsDir)) ids.add('i-' + f.replace(/\.json$/, '').replace(/-+$/, ''))

const bad = []
const hashes = []
for (const f of files) {
  const p = join(assetsDir, f)
  const reason = await placeholderReason(sharp, p)
  if (reason) bad.push([f, reason])
  hashes.push([f, await dhash(sharp, p)])
}
for (let i = 0; i < hashes.length; i++)
  for (let j = i + 1; j < hashes.length; j++)
    if (hamming(hashes[i][1], hashes[j][1]) <= 4 && !bad.some(([f]) => f === hashes[j][0]))
      bad.push([hashes[j][0], `gleiches Bild wie ${hashes[i][0]}`])

for (const f of files) if (!ids.has(f.replace(/\.jpg$/, ''))) bad.push([f, 'kein Rezept dazu (Bildleiche)'])

if (bad.length) {
  console.error(`${bad.length} verdächtige Bilder:`)
  for (const [f, reason] of bad) console.error(`  ${f.replace(/\.jpg$/, '')} – ${reason}`)
  console.error('\nEntfernen mit: node scripts/prune-recipes.mjs ' + bad.map(([f]) => f.replace(/\.jpg$/, '')).join(' '))
  process.exit(1)
}
console.log(`${files.length} Bilder geprüft, keine Platzhalter.`)
