#!/usr/bin/env node
// Erzeugt den wöchentlichen Rezept-Nachschub mit der Claude API und legt ihn als
// src/data/recipes/weekly-<ISO-Woche>.json ab (addedWeek = Zielwoche).
//
//   ANTHROPIC_API_KEY=... node scripts/generate-weekly.mjs            # für nächste Woche
//   node scripts/generate-weekly.mjs --week 2026-W40 --count 5        # explizit
//
// Ohne API-Key wird nichts erzeugt (Exit 0), damit der Workflow nicht rot wird.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { isoWeek, addWeeks } from './week.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const recipesDir = join(root, 'src/data/recipes')

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const targetWeek = arg('--week', addWeeks(isoWeek(), 1))
const count = Number(arg('--count', '5'))
const outFile = join(recipesDir, `weekly-${targetWeek}.json`)

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('Kein ANTHROPIC_API_KEY gesetzt – überspringe Generierung.')
  process.exit(0)
}
if (existsSync(outFile)) {
  console.log(`${outFile} existiert bereits – nichts zu tun.`)
  process.exit(0)
}

const ingredients = JSON.parse(readFileSync(join(root, 'src/data/ingredients.json'), 'utf8'))
const keys = Object.values(ingredients).flat().map((i) => i.key)
const schema = readFileSync(join(root, 'src/data/RECIPE_SCHEMA.md'), 'utf8')
const existingTitles = readdirSync(recipesDir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(recipesDir, f), 'utf8')))
  .map((r) => r.title)

const Ingredient = z.object({
  key: z.enum(keys),
  name: z.string(),
  amount: z.number().nullable(),
  unit: z.string(),
  optional: z.boolean(),
})

const Recipe = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  emoji: z.string(),
  category: z.enum(['hauptgericht', 'vorspeise', 'suppe', 'salat', 'beilage', 'fruehstueck', 'snack', 'nachspeise', 'backen', 'getraenk']),
  cuisine: z.enum(['deutsch', 'italienisch', 'asiatisch', 'indisch', 'mexikanisch', 'mediterran', 'amerikanisch', 'orientalisch', 'franzoesisch', 'international']),
  diet: z.array(z.enum(['vegetarisch', 'vegan', 'glutenfrei', 'laktosefrei', 'proteinreich', 'lowcarb', 'kalorienarm'])),
  timeMinutes: z.number().int(),
  difficulty: z.enum(['einfach', 'mittel', 'anspruchsvoll']),
  servings: z.number().int(),
  nutrition: z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() }),
  ingredients: z.array(Ingredient),
  steps: z.array(z.string()),
  tags: z.array(z.string()),
})

const Output = z.object({ recipes: z.array(Recipe) })

const client = new Anthropic()

console.log(`Erzeuge ${count} Rezepte für ${targetWeek} …`)
const response = await client.messages.parse({
  model: 'claude-opus-5',
  max_tokens: 16000,
  system: [
    'Du schreibst Rezepte für die deutsche Rezept-App Cookify. Antworte ausschließlich mit den Rezeptdaten im geforderten Format.',
    'Halte dich exakt an dieses Schema und diese Regeln:\n\n' + schema,
    'Erlaubte Zutaten-Keys (nur diese verwenden):\n' + keys.join(', '),
  ].join('\n\n'),
  messages: [
    {
      role: 'user',
      content:
        `Schreibe ${count} neue, abwechslungsreiche Rezepte für die Kalenderwoche ${targetWeek}: ` +
        'mindestens ein Fleisch- oder Fischgericht, ein vegetarisches oder veganes Hauptgericht, eine Nachspeise oder ein Frühstück, ' +
        'und eine Suppe oder ein Salat. Passe die Rezepte zur Jahreszeit dieser Woche an. ' +
        `Ids beginnen mit "wk-${targetWeek.toLowerCase()}-". ` +
        'Diese Titel gibt es schon, vermeide sie und sehr ähnliche Gerichte:\n' + existingTitles.join('; '),
    },
  ],
  output_config: { format: zodOutputFormat(Output) },
})

if (response.stop_reason === 'refusal') {
  console.error('Anfrage wurde abgelehnt:', response.stop_details?.explanation)
  process.exit(1)
}
if (!response.parsed_output) {
  console.error('Antwort konnte nicht geparst werden.')
  process.exit(1)
}

const recipes = response.parsed_output.recipes.map((r) => ({ ...r, addedWeek: targetWeek }))
writeFileSync(outFile, JSON.stringify(recipes, null, 2) + '\n')
console.log(`Geschrieben: ${outFile} (${recipes.length} Rezepte)`)

const check = spawnSync('node', [join(root, 'scripts/validate-recipes.mjs')], { stdio: 'inherit' })
process.exit(check.status ?? 1)
