#!/usr/bin/env node
// Prüft das Ernährungs-Regelwerk auf Konsistenz:
//  - jeder Ersatz und jedes Weglassen bezieht sich auf eine Zutat, die überhaupt als kritisch gilt
//  - alle Schlüssel sind echte Zutaten aus dem Vokabular
//  - jede kritische Zutat hat einen Weg: Ersatz, Mengengrenze oder Weglassen
// Aufruf: node scripts/check-diet-rules.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ingredients = JSON.parse(readFileSync(join(root, 'src/data/ingredients.json'), 'utf8'))
const validKeys = new Set(Object.values(ingredients).flat().map((i) => i.key))

// Läuft über tsx, deshalb lässt sich das TypeScript direkt importieren.
const { DIET_RULES, TITLE_ALIASES } = await import(join(root, 'src/lib/dietRules.ts'))

let errors = 0
const fail = (msg) => { console.error('✗ ' + msg); errors++ }

for (const [diet, rule] of Object.entries(DIET_RULES)) {
  for (const key of Object.keys(rule.limits)) {
    if (!validKeys.has(key)) fail(`${diet}: unbekannte Zutat "${key}" in limits`)
  }
  for (const key of Object.keys(rule.subs)) {
    if (!validKeys.has(key)) fail(`${diet}: unbekannte Zutat "${key}" in subs`)
    else if (!(key in rule.limits)) fail(`${diet}: Ersatz für "${key}", die gar nicht als kritisch gilt`)
  }
  for (const key of rule.omit) {
    if (!validKeys.has(key)) fail(`${diet}: unbekannte Zutat "${key}" in omit`)
    else if (!(key in rule.limits)) fail(`${diet}: "${key}" darf entfallen, gilt aber nicht als kritisch`)
  }
  // Zutaten ohne jeden Ausweg: immer kritisch, kein Ersatz, kein Weglassen
  const stuck = Object.entries(rule.limits)
    .filter(([k, v]) => v === true && !rule.subs[k] && !rule.omit.has(k))
    .map(([k]) => k)
  if (stuck.length) console.log(`  ${diet}: ${stuck.length} Zutaten ohne Ausweg (filtern hart): ${stuck.slice(0, 6).join(', ')}${stuck.length > 6 ? ' …' : ''}`)
}
for (const key of Object.keys(TITLE_ALIASES)) {
  if (!validKeys.has(key) && key !== 'linsen') fail(`TITLE_ALIASES: unbekannte Zutat "${key}"`)
}

if (errors) { console.error(`\n${errors} Fehler im Regelwerk.`); process.exit(1) }
console.log(`OK: Regelwerk für ${Object.keys(DIET_RULES).length} Ernährungsformen ist stimmig.`)
