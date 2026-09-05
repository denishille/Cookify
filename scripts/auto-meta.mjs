#!/usr/bin/env node
// Baut aus den wartenden Entwürfen eine Begleitdatei für build-from-drafts.mjs:
// Titel und Beschreibung kommen aus der Quelle, Emoji und Stichworte werden abgeleitet.
//   node scripts/auto-meta.mjs <meta.json> [--tag hellofresh]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { keyFor, parseIngredient, categoryFor, cuisineFor } from './draft-to-recipe.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const importsDir = join(root, 'src/data/imports')
const args = process.argv.slice(2)
const outPath = args.find((a) => !a.startsWith('--')) ?? join(root, 'meta.json')
const tagIdx = args.indexOf('--tag')
const sourceTag = tagIdx >= 0 ? args[tagIdx + 1] : null
const siteIdx = args.indexOf('--site')
const onlySite = siteIdx >= 0 ? args[siteIdx + 1] : null

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Emoji nach dem, was im Titel steht – das erste Muster gewinnt. */
const EMOJI = [
  [/pizza|flammkuchen/, '🍕'], [/burger/, '🍔'], [/taco/, '🌮'], [/wrap|burrito|quesadilla/, '🌯'],
  [/pancake|pfannkuch|waffel|french toast/, '🥞'], [/suppe|eintopf|ramen|brühe/, '🍲'],
  [/salat|bowl/, '🥗'], [/curry|masala|korma|tikka/, '🍛'], [/pasta|spaghetti|nudel|penne|lasagne|gnocchi|tortellini|linguine|risoni/, '🍝'],
  [/risotto|reis|paella|jambalaya/, '🍚'], [/kartoffel|pommes|rösti|knödel/, '🥔'],
  [/lachs|fisch|garnele|shrimp|scampi|kabeljau|thunfisch/, '🐟'], [/hähnchen|hühn|chicken|pute/, '🍗'],
  [/steak|rind|hack|schnitzel|schwein|gulasch|frikadelle|bolognese/, '🥩'],
  [/ei\b|eier|omelett|frittata|shakshuka/, '🍳'], [/auflauf|gratin|überbacken|ofen|blech/, '🧀'],
  [/kuchen|torte|dessert|creme|mousse|tiramisu/, '🍰'], [/pilz|champignon/, '🍄'],
  [/aubergine/, '🍆'], [/kürbis/, '🎃'], [/brokkoli|spinat|grün/, '🥦'], [/tofu|linsen|kichererbsen|falafel/, '🌱'],
  [/mais|polenta/, '🌽'], [/käse|feta|halloumi|mozzarella|ricotta/, '🧀'], [/brot|sandwich|toast|baguette|bruschetta/, '🥪'],
  [/avocado/, '🥑'], [/tomate/, '🍅'], [/paprika/, '🫑'], [/zucchini|gemüse|veggie/, '🥬'],
]
const emojiFor = (title) => EMOJI.find(([re]) => re.test(norm(title)))?.[1] ?? '🍽️'

/** Stichworte: was der Titel und die Zutaten hergeben, ohne die Ernährungs-Chips zu doppeln. */
const TAGS = [
  [/auflauf|gratin|überbacken/, 'auflauf'], [/ofen|blech/, 'aus dem ofen'], [/pfanne|wok/, 'eine pfanne'],
  [/salat/, 'salat'], [/suppe|eintopf/, 'suppe'], [/bowl/, 'bowl'], [/burger/, 'burger'],
  [/curry|masala|tikka|korma/, 'curry'], [/wrap|burrito|taco|quesadilla/, 'wrap'],
  [/cremig|creme|sahne/, 'cremig'], [/knusprig|crispy|paniert/, 'knusprig'], [/scharf|chili|sriracha|jalapeño/, 'scharf'],
  [/one pot|one-pot/, 'one pot'], [/pasta|nudel|spaghetti|penne|lasagne|gnocchi/, 'pasta'],
]
const CUISINE_TAG = { italienisch: 'italienisch', asiatisch: 'asiatisch', mexikanisch: 'mexikanisch', orientalisch: 'orientalisch', indisch: 'indisch', mediterran: 'mediterran', deutsch: 'hausmannskost', amerikanisch: 'amerikanisch' }

/** Die Quellen schreiben Werbetitel mit allen Beilagen – daraus einen Gerichtnamen machen. */
export function shortTitle(raw) {
  let t = raw.replace(/\s+/g, ' ').trim()
  // „Alu Gobhi! Blumenkohl-Curry …“ – der Aufmacher fällt weg, wenn danach ein eigener Name steht.
  const lead = /^([^!:]{3,28})[!:]\s+(.+)$/.exec(t)
  if (lead && !/^(mit|auf|und|dazu|serviert|getoppt|an|im|in|aus)\b/i.test(lead[2]) && lead[2].length >= 18) t = lead[2]
  t = t.replace(/[!:]+\s*/g, ' ').replace(/\s+/g, ' ').trim()
  // Werbezeilen, die die Quelle in den Titel schreibt.
  t = t.split(/\s+(?:Bei diesem (?:Gericht|Rezept)|Nur \d+ Minuten|Mit mehr als|Enthält|Klimaheld|verzehrfertiges)\b/i)[0].trim()
  // Alles ab der ersten Beilagenaufzählung abschneiden – aber nur, wenn ein Gerichtname stehen bleibt.
  const cut = (text, re) => { const head = text.split(re)[0].trim(); return head.length >= 14 ? head : text }
  t = cut(t, /\s*[–-]?\s*\b(?:dazu|getoppt|serviert|obendrauf|zum Dippen)\b/i)
  t = cut(t, /,/)
  if (t.length > 52) t = cut(t, /\s+und\s+/i)
  if (t.length > 58) {
    const m = /^(.{18,58})\s+mit\s+/i.exec(t)
    if (m) t = m[1].trim()
  }
  if (t.length > 70) t = t.slice(0, 66).replace(/\s+\S*$/, '') + '…'
  return t.replace(/\s*[-–,]\s*$/, '').trim()
}

/** Die Werbetexte der Quellen sind lang – auf zwei Sätze und rund 150 Zeichen kürzen. */
function shorten(text, title) {
  let t = (text ?? '').replace(/\s+/g, ' ').trim()
  t = t.replace(/^["„»]|["“«]$/g, '').trim()
  if (!t) return ''
  const sentences = t.split(/(?<=[.!?])\s+/)
  let out = ''
  for (const s of sentences) {
    if (out && (out + ' ' + s).length > 165) break
    out = out ? `${out} ${s}` : s
    if (out.length > 110) break
  }
  if (out.length > 190) out = out.slice(0, 185).replace(/\s+\S*$/, '') + ' …'
  if (norm(out) === norm(title)) return ''
  return out
}

const meta = {}
for (const file of readdirSync(importsDir).filter((f) => f.endsWith('.json')).sort()) {
  const d = JSON.parse(readFileSync(join(importsDir, file), 'utf8'))
  if (onlySite && d.source?.site !== onlySite) continue
  const name = file.replace(/\.json$/, '')
  const parsed = d.ingredients.map(parseIngredient).filter(Boolean)
  const keys = parsed.map((p) => keyFor(p.name)).filter(Boolean)
  const ings = parsed.map((p) => p.name.replace(/\s{2,}/g, ' ').trim()).filter(Boolean)
  const title = shortTitle(d.title)
  const n = norm(title)
  const category = categoryFor(title, keys)
  const cuisine = cuisineFor(title, keys)
  const tags = new Set()
  for (const [re, tag] of TAGS) if (re.test(n)) tags.add(tag)
  if (CUISINE_TAG[cuisine]) tags.add(CUISINE_TAG[cuisine])
  if ((d.timeMinutes ?? 30) <= 25) tags.add('schnell')
  if (category === 'nachspeise') tags.add('süß')
  if (sourceTag) tags.add(sourceTag)
  if (tags.size < 3) tags.add('feierabend')
  const main = ings.filter((i) => !/salz|pfeffer|\u00f6l|wasser|zucker/.test(norm(i))).slice(0, 3)
  const fallback = `In ${d.timeMinutes ?? 30} Minuten fertig${main.length ? `, mit ${main.slice(0, -1).join(', ')}${main.length > 1 ? ' und ' : ''}${main[main.length - 1]}` : ''}.`
  const raw = /klimaheld|hellofresh|verzehrfertig|kalorienbewusst|nachhaltig zertifiziert/i.test(d.description ?? '') ? '' : d.description
  const desc = shorten(raw, title)
  meta[name] = {
    title,
    description: desc.length >= 25 ? desc : fallback,
    emoji: emojiFor(title),
    tags: [...tags].slice(0, 5),
  }
}

writeFileSync(outPath, JSON.stringify(meta, null, 2) + '\n')
console.log(`${Object.keys(meta).length} Einträge → ${outPath}`)
