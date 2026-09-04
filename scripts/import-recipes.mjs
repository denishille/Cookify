#!/usr/bin/env node
// Importiert Rezepte von Rezeptseiten (EatSmarter, lecker.de, kochbar, HelloFresh, KptnCook …)
// über deren öffentliche schema.org/Recipe-Daten und macht daraus eigene Cookify-Rezepte.
//
// Schritt 1 – holen:   node scripts/import-recipes.mjs --urls https://… https://…
//                      node scripts/import-recipes.mjs --search "Lasagne" --limit 5     (braucht BRAVE_API_KEY)
//                      node scripts/import-recipes.mjs --file urls.txt                   (eine URL pro Zeile)
//   → Entwürfe in src/data/imports/<slug>.json (Titel, Zutaten, Schritte, Zeit, Portionen, Bewertung, Quelle).
//     Hinweis: Die Bilder gehören den Quellseiten; Nutzung nur privat.
//
// Bilder:  node scripts/import-recipes.mjs --images-for m-wiener-schnitzel,v-linsen-dal   (Bild der Quellseite für vorhandene Rezepte)
//          node scripts/import-recipes.mjs --images-all                                  (für alle Rezepte mit Quelle und ohne Bild)
//          --with-images beim Holen: Bild wird zusammen mit dem Entwurf gespeichert
//
// Schritt 2 – umschreiben:  ANTHROPIC_API_KEY=… node scripts/import-recipes.mjs --rewrite
//   → Claude formt die Entwürfe in unser Schema um (eigener Text, Zutaten-Keys, Nährwerte, Kategorie),
//     validiert sie und schreibt src/data/recipes/imported-<datum>.json plus Quellen in src/data/sources/imported.json.
//
// Läuft auf einem Rechner mit offenem Internet, nicht in der Claude-Sandbox.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const importsDir = join(root, 'src/data/imports')
const assetsDir = join(root, 'src/assets/recipes')
const recipesDir = join(root, 'src/data/recipes')
const sourcesDir = join(root, 'src/data/sources')
mkdirSync(importsDir, { recursive: true })

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const limit = Number(opt('--limit', '10'))

export const ALLOWED_SITES = ['eatsmarter.de', 'lecker.de', 'kochbar.de', 'hellofresh.de', 'kptncook.com', 'essen-und-trinken.de', 'kuechengoetter.de', 'einfachkochen.de', 'springlane.de', 'gaumenfreundin.de', 'emmikochteinfach.de', 'malteskitchen.de', 'brigitte.de', 'rewe.de', 'edeka.de', 'chefkoch.de', 'daskochrezept.de', 'kitchenstories.com', 'zuckerzimtundliebe.de', 'eat-this.org', 'bianca-zapatka.com', 'elavegan.com', 'stefanskochblog.de', 'toastenstein.com', 'simply-yummy.de', 'lisa-lecker.de']
const UA = 'CookifyBot/1.0 (+https://github.com/denishille/Cookify; liest nur schema.org-Rezeptmetadaten)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const siteOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
const slug = (t) => t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
const text = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.map(text).join(' ') : v?.text ?? v?.name ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

/** ISO-8601-Dauer (PT1H30M) → Minuten */
function minutes(iso) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso ?? '')
  if (!m) return undefined
  const v = (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)
  return v || undefined
}

/** Alle schema.org/Recipe-Objekte aus den JSON-LD-Blöcken einer Seite. */
export function parseRecipe(html, url) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  for (const raw of blocks) {
    let data
    try { data = JSON.parse(raw.trim()) } catch { continue }
    const nodes = []
    const walk = (n) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(walk); nodes.push(n); if (n['@graph']) walk(n['@graph']) }
    walk(data)
    const r = nodes.find((n) => [].concat(n['@type'] ?? []).includes('Recipe'))
    if (!r) continue
    const steps = []
    const collect = (ins) => {
      if (!ins) return
      if (typeof ins === 'string') return steps.push(...ins.split(/\n+/).map((s) => s.trim()).filter(Boolean))
      if (Array.isArray(ins)) return ins.forEach(collect)
      if (ins['@type'] === 'HowToSection') return collect(ins.itemListElement)
      const t = text(ins.text ?? ins.name); if (t) steps.push(t)
    }
    collect(r.recipeInstructions)
    const ar = r.aggregateRating ?? {}
    const best = Number(ar.bestRating)
    // Manche Seiten liefern 0–1 statt 0–5 (kuechengoetter). Auf die 5er-Skala normalisieren.
    const value = Number(ar.ratingValue)
    const scale = Number.isFinite(best) && best > 0 ? 5 / best : value > 0 && value <= 1 ? 5 : 1
    const rating = value * scale, count = Number(ar.ratingCount ?? ar.reviewCount)
    const img = [].concat(r.image ?? [])[0]
    const image = typeof img === 'string' ? img : img?.url ?? img?.contentUrl ?? undefined
    const yieldText = text(Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield)
    const servings = Number((/\d+/.exec(yieldText) ?? [])[0]) || undefined
    return {
      title: text(r.name),
      description: text(r.description),
      ingredients: [].concat(r.recipeIngredient ?? []).map(text).filter(Boolean),
      steps: steps.map((s) => s.replace(/<[^>]+>/g, '').trim()).filter(Boolean),
      timeMinutes: minutes(r.totalTime) ?? ((minutes(r.prepTime) ?? 0) + (minutes(r.cookTime) ?? 0) || undefined),
      servings,
      category: text(r.recipeCategory) || undefined,
      cuisine: text(r.recipeCuisine) || undefined,
      keywords: text(r.keywords) || undefined,
      image,
      source: {
        site: siteOf(url), url, title: text(r.name),
        ...(Number.isFinite(rating) && rating > 0 ? { rating: Math.round(rating * 10) / 10 } : {}),
        ...(Number.isFinite(count) && count > 0 ? { ratingCount: Math.round(count) } : {}),
      },
      importedAt: new Date().toISOString().slice(0, 10),
    }
  }
  return null
}

async function fetchRecipe(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return parseRecipe(await res.text(), url)
}

/** Lädt das Bild einer Quellseite und speichert es als 800×600-JPEG unter src/assets/recipes/<id>.jpg. */
async function saveImage(imageUrl, id) {
  const { default: sharp } = await import('sharp')
  const res = await fetch(imageUrl, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`Bild HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(assetsDir, { recursive: true })
  const out = join(assetsDir, `${id}.jpg`)
  await sharp(buf).resize(800, 600, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toFile(out)
  return out
}

async function search(query, count) {
  if (!process.env.BRAVE_API_KEY) throw new Error('BRAVE_API_KEY fehlt (für --search)')
  const u = new URL('https://api.search.brave.com/res/v1/web/search')
  u.searchParams.set('q', `${query} Rezept (${ALLOWED_SITES.map((s) => `site:${s}`).join(' OR ')})`)
  u.searchParams.set('country', 'de'); u.searchParams.set('search_lang', 'de'); u.searchParams.set('count', String(count))
  const res = await fetch(u, { headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY } })
  if (!res.ok) throw new Error(`Brave ${res.status}`)
  return ((await res.json()).web?.results ?? []).map((r) => r.url).filter((url) => ALLOWED_SITES.includes(siteOf(url)))
}

// ---------- Bilder für vorhandene Rezepte ----------
if (flag('--images-for') || flag('--images-all')) {
  const backlogDir = join(root, 'src/data/backlog')
  const all = [recipesDir, backlogDir].filter(existsSync).flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))))
  const sources = Object.assign({}, ...readdirSync(sourcesDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(sourcesDir, f), 'utf8'))))
  const wanted = flag('--images-for') ? opt('--images-for').split(',').map((x) => x.trim()) : all.filter((r) => sources[r.id] && !existsSync(join(assetsDir, `${r.id}.jpg`))).map((r) => r.id)
  let ok = 0
  for (const id of wanted) {
    const src = sources[id]
    if (!src) { console.log(`– ${id}: keine Quelle hinterlegt`); continue }
    try {
      const r = await fetchRecipe(src.url)
      if (!r?.image) { console.log(`– ${id}: Quellseite hat kein Bild in den Rezeptdaten`); continue }
      await saveImage(r.image, id)
      ok++
      console.log(`✓ ${id} ← ${src.site}`)
    } catch (e) { console.error(`✗ ${id}: ${e.message}`) }
    await sleep(1500)
  }
  console.log(`\n${ok} Bilder gespeichert in src/assets/recipes/. Danach: git add src/assets/recipes && git commit`)
  process.exit(0)
}

// ---------- Schritt 1: holen ----------
if (!flag('--rewrite')) {
  let urls = []
  if (flag('--urls')) urls = args.slice(args.indexOf('--urls') + 1).filter((a) => a.startsWith('http'))
  if (flag('--file')) urls.push(...readFileSync(opt('--file'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('http')))
  if (flag('--search')) urls.push(...(await search(opt('--search'), limit)))
  urls = [...new Set(urls)].filter((u) => ALLOWED_SITES.includes(siteOf(u))).slice(0, limit)
  if (urls.length === 0) { console.log('Keine URLs. Nutze --urls, --file oder --search.'); process.exit(1) }
  let ok = 0
  for (const url of urls) {
    try {
      const r = await fetchRecipe(url)
      if (!r || !r.title || r.ingredients.length < 3 || r.steps.length < 2) { console.log(`– ${url}: keine vollständigen Rezeptdaten`); continue }
      const file = join(importsDir, `${slug(r.title)}.json`)
      writeFileSync(file, JSON.stringify(r, null, 2) + '\n')
      if (flag('--with-images') && r.image) {
        try { await saveImage(r.image, `i-${slug(r.title)}`); console.log(`  Bild gespeichert`) } catch (e) { console.error(`  Bild fehlgeschlagen: ${e.message}`) }
      }
      ok++
      console.log(`✓ ${r.title} (${r.ingredients.length} Zutaten, ${r.steps.length} Schritte${r.source.rating ? `, ${r.source.rating} ★ / ${r.source.ratingCount ?? '?'}` : ''}) ← ${r.source.site}`)
    } catch (e) { console.error(`✗ ${url}: ${e.message}`) }
    await sleep(1500)
  }
  console.log(`\n${ok} Entwürfe in src/data/imports/. Weiter mit: ANTHROPIC_API_KEY=… node scripts/import-recipes.mjs --rewrite`)
  process.exit(0)
}

// ---------- Schritt 2: umschreiben ----------
const drafts = readdirSync(importsDir).filter((f) => f.endsWith('.json')).map((f) => ({ file: join(importsDir, f), data: JSON.parse(readFileSync(join(importsDir, f), 'utf8')) }))
if (drafts.length === 0) { console.log('Keine Entwürfe in src/data/imports/.'); process.exit(0) }
if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY fehlt.'); process.exit(1) }

const { default: Anthropic } = await import('@anthropic-ai/sdk')
const { z } = await import('zod')
const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod')

const ingredients = JSON.parse(readFileSync(join(root, 'src/data/ingredients.json'), 'utf8'))
const keys = Object.values(ingredients).flat().map((i) => i.key)
const schema = readFileSync(join(root, 'src/data/RECIPE_SCHEMA.md'), 'utf8')
const existing = readdirSync(recipesDir).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(recipesDir, f), 'utf8')))
const existingIds = new Set(existing.map((r) => r.id))

const Recipe = z.object({
  id: z.string(), title: z.string(), description: z.string(), emoji: z.string(),
  category: z.enum(['hauptgericht', 'vorspeise', 'suppe', 'salat', 'beilage', 'fruehstueck', 'snack', 'nachspeise', 'backen', 'getraenk']),
  cuisine: z.enum(['deutsch', 'italienisch', 'asiatisch', 'indisch', 'mexikanisch', 'mediterran', 'amerikanisch', 'orientalisch', 'franzoesisch', 'international']),
  diet: z.array(z.enum(['vegetarisch', 'vegan', 'glutenfrei', 'laktosefrei', 'proteinreich', 'lowcarb', 'kalorienarm', 'lowfodmap', 'fruktosefrei', 'leichtverdaulich'])),
  timeMinutes: z.number().int(), difficulty: z.enum(['einfach', 'mittel', 'anspruchsvoll']), servings: z.number().int(),
  nutrition: z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() }),
  ingredients: z.array(z.object({ key: z.enum(keys), name: z.string(), amount: z.number().nullable(), unit: z.string(), optional: z.boolean() })),
  steps: z.array(z.string()), tags: z.array(z.string()),
})
const client = new Anthropic()
const out = [], sources = {}
const day = new Date().toISOString().slice(0, 10)

for (const { file, data } of drafts) {
  const idBase = `i-${slug(data.title)}`
  let id = idBase, n = 2
  while (existingIds.has(id) || out.some((r) => r.id === id)) id = `${idBase}-${n++}`
  console.log(`Umschreiben: ${data.title} …`)
  try {
    const res = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 8000,
      system: ['Du überträgst importierte Rezeptdaten in das Format der Rezept-App Cookify. Antworte nur mit dem Rezept im geforderten Format.',
        'Schema und Regeln:\n\n' + schema, 'Erlaubte Zutaten-Keys (nur diese):\n' + keys.join(', ')].join('\n\n'),
      messages: [{ role: 'user', content:
        `Erzeuge daraus ein Cookify-Rezept mit der id "${id}". Übernimm Zutaten und Mengen (Portionen: ${data.servings ?? 'unbekannt'}), ` +
        'schreibe Beschreibung und Zubereitungsschritte vollständig neu in eigenen Worten (Du-Form, konkrete Zeiten und Temperaturen), ' +
        'ordne Kategorie, Küche, Ernährungsform, Schwierigkeit zu und schätze die Nährwerte pro Portion realistisch.\n\n' +
        `Titel: ${data.title}\nBeschreibung: ${data.description}\nZeit: ${data.timeMinutes ?? '?'} Min\nKategorie laut Quelle: ${data.category ?? '–'}\nStichworte: ${data.keywords ?? '–'}\n` +
        `Zutaten:\n${data.ingredients.map((i) => '- ' + i).join('\n')}\n\nSchritte laut Quelle:\n${data.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` }],
      output_config: { format: zodOutputFormat(Recipe) },
    })
    if (res.stop_reason === 'refusal' || !res.parsed_output) { console.error(`✗ ${data.title}: keine verwertbare Antwort`); continue }
    out.push(res.parsed_output)
    sources[res.parsed_output.id] = data.source
    unlinkSync(file)
    console.log(`✓ ${res.parsed_output.title}`)
  } catch (e) { console.error(`✗ ${data.title}: ${e.message}`) }
}

if (out.length) {
  const target = join(recipesDir, `imported-${day}.json`)
  const prev = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : []
  writeFileSync(target, JSON.stringify([...prev, ...out], null, 2) + '\n')
  const srcFile = join(sourcesDir, 'imported.json')
  const prevSrc = existsSync(srcFile) ? JSON.parse(readFileSync(srcFile, 'utf8')) : {}
  writeFileSync(srcFile, JSON.stringify({ ...prevSrc, ...sources }, null, 2) + '\n')
  console.log(`\n${out.length} Rezepte → ${target}`)
  const check = spawnSync('node', [join(root, 'scripts/validate-recipes.mjs')], { stdio: 'inherit' })
  process.exit(check.status ?? 1)
}
