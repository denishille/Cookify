#!/usr/bin/env node
// Erzeugt fotorealistische KI-Bilder für alle Rezepte ohne Bild und legt sie als
// src/assets/recipes/<id>.jpg (800×600, JPEG) ab.
//
// Anbieter (wird über den gesetzten Schlüssel gewählt):
//   OPENAI_API_KEY       → OpenAI Images (gpt-image-1)
//   REPLICATE_API_TOKEN  → Replicate, black-forest-labs/flux-schnell
//
//   node scripts/generate-images.mjs                 # alle fehlenden
//   node scripts/generate-images.mjs --limit 20      # höchstens 20
//   node scripts/generate-images.mjs --ids m-wiener-schnitzel,v-linsen-dal
//   node scripts/generate-images.mjs --dry-run       # nur Prompts anzeigen
//   node scripts/generate-images.mjs --force         # vorhandene ersetzen
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const recipesDir = join(root, 'src/data/recipes')
const outDir = join(root, 'src/assets/recipes')
mkdirSync(outDir, { recursive: true })

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback }
const limit = Number(opt('--limit', '0'))
const onlyIds = opt('--ids', '')?.split(',').filter(Boolean) ?? []
const dryRun = flag('--dry-run')
const force = flag('--force')
const concurrency = Number(opt('--concurrency', '3'))

const CATEGORY_HINT = {
  hauptgericht: 'a plated main course',
  suppe: 'a bowl of soup',
  salat: 'a fresh salad in a bowl',
  fruehstueck: 'a breakfast dish',
  snack: 'a snack',
  nachspeise: 'a dessert',
}

/** Bild-Prompt aus den Rezeptdaten. Deutsch für Titel/Beschreibung, Englisch für Stilvorgaben. */
export function buildPrompt(r) {
  const mains = r.ingredients.filter((i) => !i.optional && i.amount !== null).slice(0, 6).map((i) => i.name).join(', ')
  return [
    `Professional food photography of ${CATEGORY_HINT[r.category] ?? 'a dish'}: "${r.title}".`,
    r.description,
    `Visible ingredients: ${mains}.`,
    'Realistic, appetizing, freshly prepared, served on a simple ceramic plate or bowl on a light wooden table,',
    'soft natural daylight from the side, 45-degree angle, shallow depth of field, no text, no people, no hands, no logos.',
  ].join(' ')
}

async function openai(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024', quality: 'medium', n: 1 }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return Buffer.from(data.data[0].b64_json, 'base64')
}

async function replicate(prompt) {
  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({ input: { prompt, aspect_ratio: '4:3', output_format: 'jpg', output_quality: 90, num_outputs: 1 } }),
  })
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${(await res.text()).slice(0, 300)}`)
  let pred = await res.json()
  // Falls "Prefer: wait" nicht reichte: nachfragen, bis fertig.
  for (let i = 0; i < 60 && (pred.status === 'starting' || pred.status === 'processing'); i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const poll = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` } })
    pred = await poll.json()
  }
  if (pred.status !== 'succeeded') throw new Error(`Replicate: ${pred.status} ${pred.error ?? ''}`)
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
  const img = await fetch(url)
  if (!img.ok) throw new Error(`Download ${img.status}`)
  return Buffer.from(await img.arrayBuffer())
}

const provider = process.env.OPENAI_API_KEY ? openai : process.env.REPLICATE_API_TOKEN ? replicate : null

const recipes = readdirSync(recipesDir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(recipesDir, f), 'utf8')))

let todo = recipes.filter((r) => (onlyIds.length ? onlyIds.includes(r.id) : true))
if (!force) todo = todo.filter((r) => !existsSync(join(outDir, `${r.id}.jpg`)))
if (limit > 0) todo = todo.slice(0, limit)

console.log(`${recipes.length} Rezepte, ${todo.length} ohne Bild${dryRun ? ' (Dry-Run)' : ''}.`)
if (dryRun) {
  for (const r of todo) console.log(`\n${r.id}\n  ${buildPrompt(r)}`)
  process.exit(0)
}
if (todo.length === 0) process.exit(0)
if (!provider) {
  console.log('Kein OPENAI_API_KEY oder REPLICATE_API_TOKEN gesetzt – überspringe Bildgenerierung.')
  process.exit(0)
}

let ok = 0, failed = 0
const queue = [...todo]
async function worker() {
  while (queue.length) {
    const r = queue.shift()
    const out = join(outDir, `${r.id}.jpg`)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const raw = await provider(buildPrompt(r))
        const jpg = await sharp(raw).resize(800, 600, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
        writeFileSync(out, jpg)
        ok++
        console.log(`✓ ${r.id} (${Math.round(jpg.length / 1024)} KB)`)
        break
      } catch (e) {
        console.error(`✗ ${r.id} Versuch ${attempt}: ${e.message}`)
        if (attempt === 3) failed++
        else await new Promise((res) => setTimeout(res, 3000 * attempt))
      }
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker))
console.log(`\nFertig: ${ok} Bilder erzeugt, ${failed} fehlgeschlagen.`)
process.exit(failed && !ok ? 1 : 0)
