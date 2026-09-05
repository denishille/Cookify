#!/usr/bin/env node
// Baut aus den Entwürfen in src/data/imports fertige Rezepte.
// Titel und Beschreibung kommen aus einer Begleitdatei: { "<entwurf>": { "title": "…", "description": "…", "category": "…" } }
//   node scripts/build-from-drafts.mjs <meta.json> <ziel.json>
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { keyFor, parseIngredient, estimateNutrition, cleanStep, dietFor, cuisineFor, categoryFor, difficultyFor } from './draft-to-recipe.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const importsDir = join(root, 'src/data/imports')
const argv = process.argv.slice(2)
const minIdx = argv.indexOf('--min-zutaten')
const MIN_INGREDIENTS = minIdx >= 0 ? Number(argv[minIdx + 1]) : 6
const [metaPath, targetPath] = argv.filter((a) => !a.startsWith('--') && a !== argv[minIdx + 1])
const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
const target = targetPath ?? join(root, 'src/data/recipes/hellofresh.json')

/** Markennamen und Kürzel aus den Zutatennamen nehmen. */
function cleanName(name) {
  return name
    .replace(/Gewürzmischung\s*[„"']?([^"'“”]*)[”"']?/i, (_, n) => n.trim() || 'Gewürzmischung')
    .replace(/\s*(D\.O\.P\.|ital\. Art|– DONT USE|\(vegetatisch\)|\(vegetarisch\)|nach Fajita-Art)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^,\s*/, '')
    .trim()
}

const out = []
const skipped = []
for (const [file, m] of Object.entries(meta)) {
  const path = join(importsDir, file + '.json')
  if (!existsSync(path)) { skipped.push(`${file}: kein Entwurf`); continue }
  const d = JSON.parse(readFileSync(path, 'utf8'))
  const list = d.ingredients.map(parseIngredient).filter(Boolean)
    .map((p) => ({ key: keyFor(p.name), name: cleanName(p.name), amount: p.amount, unit: p.amount === null ? '' : p.unit }))
    .filter((p) => p.key && p.name.toLowerCase() !== 'wasser')
  // gleiche Zutat nur einmal
  const seen = new Set()
  const ingredients = list.filter((i) => (seen.has(i.key) ? false : seen.add(i.key)))
  if (ingredients.length < MIN_INGREDIENTS) { skipped.push(`${file}: nur ${ingredients.length} Zutaten`); continue }
  const trimmed = ingredients.slice(0, 14)
  let steps = d.steps.map(cleanStep).filter((s) => s.length > 15)
  // Manche Quellen fassen alles in drei Blöcke: dann an Satzgrenzen teilen, bis vier Schritte dastehen.
  while (steps.length < 4 && steps.some((s) => s.length > 160)) {
    const i = steps.findIndex((s) => s.length > 160)
    const parts = steps[i].split(/(?<=\.)\s+/)
    const half = Math.ceil(parts.length / 2)
    steps.splice(i, 1, parts.slice(0, half).join(' ').trim(), parts.slice(half).join(' ').trim())
  }
  steps = (m.steps ?? steps).filter((s) => s.length > 15).slice(0, 9)
  if (steps.length < 4) { skipped.push(`${file}: nur ${steps.length} Schritte`); continue }
  const keys = trimmed.map((i) => i.key)
  const servings = d.servings ?? 2
  const title = m.title ?? d.title
  out.push({
    id: `i-${file}`.replace(/-+$/, ''),
    title,
    description: m.description ?? '',
    emoji: m.emoji ?? '🍽️',
    category: m.category ?? categoryFor(title, keys),
    cuisine: m.cuisine ?? cuisineFor(title, keys),
    diet: dietFor(keys),
    timeMinutes: d.timeMinutes ?? 30,
    difficulty: difficultyFor(d.timeMinutes ?? 30, steps.length),
    servings,
    nutrition: estimateNutrition(trimmed, servings),
    ingredients: trimmed,
    steps,
    tags: m.tags ?? ['hellofresh'],
    source: d.source,
  })
}

const prev = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : []
const ids = new Set(prev.map((r) => r.id))
const fresh = out.filter((r) => !ids.has(r.id))
writeFileSync(target, JSON.stringify([...prev, ...fresh], null, 2) + '\n')
for (const r of fresh) {
  const f = join(importsDir, r.id.slice(2) + '.json')
  if (existsSync(f)) unlinkSync(f)
}
console.log(`${fresh.length} Rezepte ergänzt → ${target}`)
if (skipped.length) console.log('übersprungen:\n' + skipped.join('\n'))
