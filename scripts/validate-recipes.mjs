#!/usr/bin/env node
// Validiert alle Rezeptdateien in src/data/recipes gegen das Schema und das Zutaten-Vokabular.
// Aufruf: node scripts/validate-recipes.mjs [datei.json ...]
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ingredients = JSON.parse(readFileSync(join(root, 'src/data/ingredients.json'), 'utf8'))
const validKeys = new Set(Object.values(ingredients).flat().map((i) => i.key))

const CATEGORIES = ['hauptgericht', 'suppe', 'salat', 'fruehstueck', 'snack', 'nachspeise', 'backen']
const CUISINES = ['deutsch', 'italienisch', 'asiatisch', 'indisch', 'mexikanisch', 'mediterran', 'amerikanisch', 'orientalisch', 'franzoesisch', 'international']
const DIETS = ['vegetarisch', 'vegan', 'glutenfrei', 'laktosefrei', 'proteinreich', 'lowcarb', 'kalorienarm', 'fruktosefrei', 'leichtverdaulich']
const DIFFICULTIES = ['einfach', 'mittel', 'anspruchsvoll']

const dir = join(root, 'src/data/recipes')
const files = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f))

let errors = 0
const seenIds = new Map()
let total = 0

for (const file of files) {
  let data
  try {
    data = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`${file}: kein gültiges JSON (${e.message})`)
    errors++
    continue
  }
  if (!Array.isArray(data)) {
    console.error(`${file}: muss ein Array sein`)
    errors++
    continue
  }
  data.forEach((r, i) => {
    total++
    const where = `${file}[${i}] (${r?.id ?? '?'})`
    const fail = (msg) => { console.error(`${where}: ${msg}`); errors++ }
    if (!r || typeof r !== 'object') return fail('kein Objekt')
    if (typeof r.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) fail('ungültige id')
    if (seenIds.has(r.id)) fail(`doppelte id (auch in ${seenIds.get(r.id)})`)
    seenIds.set(r.id, file)
    if (typeof r.title !== 'string' || !r.title.trim()) fail('title fehlt')
    if (typeof r.description !== 'string' || r.description.length < 20) fail('description zu kurz')
    if (typeof r.emoji !== 'string' || !r.emoji.trim()) fail('emoji fehlt')
    if (!CATEGORIES.includes(r.category)) fail(`ungültige category "${r.category}"`)
    if (!CUISINES.includes(r.cuisine)) fail(`ungültige cuisine "${r.cuisine}"`)
    if (!Array.isArray(r.diet) || r.diet.some((d) => !DIETS.includes(d))) fail(`ungültige diet ${JSON.stringify(r.diet)}`)
    if (!Number.isInteger(r.timeMinutes) || r.timeMinutes <= 0) fail('timeMinutes ungültig')
    if (!DIFFICULTIES.includes(r.difficulty)) fail(`ungültige difficulty "${r.difficulty}"`)
    if (!Number.isInteger(r.servings) || r.servings <= 0) fail('servings ungültig')
    const n = r.nutrition
    if (!n || ['kcal', 'protein', 'carbs', 'fat'].some((k) => typeof n[k] !== 'number' || n[k] < 0)) fail('nutrition ungültig')
    if (!Array.isArray(r.ingredients) || r.ingredients.length < 3) fail('zu wenige ingredients')
    else r.ingredients.forEach((ing, j) => {
      if (!validKeys.has(ing.key)) fail(`ingredient[${j}] unbekannter key "${ing.key}"`)
      if (typeof ing.name !== 'string' || !ing.name.trim()) fail(`ingredient[${j}] name fehlt`)
      if (!(ing.amount === null || typeof ing.amount === 'number')) fail(`ingredient[${j}] amount ungültig`)
      if (typeof ing.unit !== 'string') fail(`ingredient[${j}] unit ungültig`)
    })
    if (!Array.isArray(r.steps) || r.steps.length < 3 || r.steps.some((s) => typeof s !== 'string' || s.length < 10)) fail('steps ungültig')
    if (!Array.isArray(r.tags) || r.tags.some((t) => typeof t !== 'string')) fail('tags ungültig')
  })
}

if (errors) {
  console.error(`\n${errors} Fehler in ${total} Rezepten.`)
  process.exit(1)
}
console.log(`OK: ${total} Rezepte in ${files.length} Dateien, ${validKeys.size} bekannte Zutaten.`)
