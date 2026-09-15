#!/usr/bin/env tsx
// Prüft, wie gut die Zutaten den Arbeitsschritten zugeordnet werden (src/lib/stepIngredients.ts):
// wie viele Schritte eine Zutat bekommen und wie viele Zutaten irgendwo im Ablauf auftauchen.
//
//   npm run steps:check              # nur die Zahlen
//   npm run steps:check -- 0,500     # dazu die Rezepte an diesen Stellen zum Nachlesen
//   npm run steps:check -- --leer    # Rezepte, bei denen kaum etwas zugeordnet wird
import { readdirSync, readFileSync } from 'node:fs'
import { stepIngredients } from '../src/lib/stepIngredients'
import type { Recipe } from '../src/types'

const dir = 'src/data/recipes'
const alle: Recipe[] = readdirSync(dir).flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as Recipe[])
const gesehen = new Set<string>()
const rezepte = alle.filter((r) => (gesehen.has(r.id) ? false : (gesehen.add(r.id), true)))

let schritte = 0, mitZutat = 0, treffer = 0, zutaten = 0, genannt = 0
const schwach: { titel: string; anteil: number }[] = []
for (const r of rezepte) {
  const drin = new Set<string>()
  for (const s of r.steps) {
    schritte++
    const t = stepIngredients(s, r.ingredients)
    if (t.length) { mitZutat++; treffer += t.length }
    t.forEach((i) => drin.add(i.key))
  }
  zutaten += r.ingredients.length
  genannt += r.ingredients.filter((i) => drin.has(i.key)).length
  const anteil = r.ingredients.length ? drin.size / r.ingredients.length : 1
  if (anteil < 0.5) schwach.push({ titel: r.title, anteil })
}

console.log(`Rezepte ${rezepte.length}, Schritte ${schritte}`)
console.log(`Schritte mit mindestens einer Zutat: ${mitZutat} (${Math.round((mitZutat / schritte) * 100)} %)`)
console.log(`Zutaten je Schritt im Schnitt: ${(treffer / schritte).toFixed(2)}`)
console.log(`Zutaten irgendwo im Ablauf genannt: ${genannt} von ${zutaten} (${Math.round((genannt / zutaten) * 100)} %)`)

if (process.argv.includes('--leer')) {
  console.log(`\nRezepte mit weniger als der Hälfte zugeordnet: ${schwach.length}`)
  schwach.sort((a, b) => a.anteil - b.anteil).slice(0, 25)
    .forEach((x) => console.log(`  ${Math.round(x.anteil * 100).toString().padStart(3)} %  ${x.titel}`))
}

for (const n of (process.argv.find((a) => /^\d+(,\d+)*$/.test(a)) ?? '').split(',').filter(Boolean).map(Number)) {
  const r = rezepte[n]
  if (!r) continue
  console.log(`\n== ${r.title}`)
  for (const s of r.steps) {
    console.log('  • ' + s)
    const t = stepIngredients(s, r.ingredients).map((i) => `${i.amount ?? ''} ${i.unit} ${i.name}`.replace(/\s+/g, ' ').trim())
    console.log('    → ' + (t.join(' · ') || '—'))
  }
}
