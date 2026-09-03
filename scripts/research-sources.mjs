#!/usr/bin/env node
// Recherchiert gut bewertete Originalrezepte zu unseren Rezepten und hält die Bewertungen aktuell.
// Liest dazu die strukturierten Rezeptdaten (schema.org/Recipe als JSON-LD), die Rezeptseiten
// öffentlich für Suchmaschinen bereitstellen: Name, URL, aggregateRating. Texte und Bilder werden
// nicht übernommen. Läuft auf GitHub Actions (offenes Netz); aus der Sandbox heraus nicht nutzbar.
//
//   node scripts/research-sources.mjs --refresh          # Bewertungen vorhandener Quellen aktualisieren
//   node scripts/research-sources.mjs --fill             # Quellen für Rezepte ohne Quelle suchen (braucht BRAVE_API_KEY)
//   node scripts/research-sources.mjs --discover 40      # 40 neue, gut bewertete Gerichte als Kandidaten sammeln
//   node scripts/research-sources.mjs --limit 30         # Obergrenze pro Modus
//
// Suche: Brave Search API (Secret BRAVE_API_KEY, kostenloser Tarif reicht). Ohne Key funktioniert nur --refresh.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const recipesDir = join(root, 'src/data/recipes')
const sourcesDir = join(root, 'src/data/sources')
const autoFile = join(sourcesDir, 'auto.json')
const candidatesFile = join(root, 'src/data/candidates.json')

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const limit = Number(opt('--limit', '0'))
const discoverN = Number(opt('--discover', '0'))

/** Seiten, deren Rezeptseiten wir als Quelle verlinken. chefkoch.de bewusst nicht: verbietet automatisierte Abfragen. */
export const ALLOWED_SITES = ['eatsmarter.de', 'lecker.de', 'kochbar.de', 'hellofresh.de', 'kptncook.com', 'essen-und-trinken.de', 'kuechengoetter.de', 'einfachkochen.de', 'springlane.de', 'gaumenfreundin.de', 'emmikochteinfach.de', 'malteskitchen.de', 'brigitte.de', 'rewe.de', 'edeka.de']

const UA = 'CookifyBot/1.0 (+https://github.com/denishille/Cookify; liest nur schema.org-Rezeptmetadaten)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function siteOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

/** Holt eine Seite und liest das erste schema.org/Recipe aus den JSON-LD-Blöcken. */
export async function readRecipeMeta(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  for (const raw of blocks) {
    let data
    try { data = JSON.parse(raw.trim()) } catch { continue }
    const nodes = []
    const walk = (n) => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(walk)
      nodes.push(n)
      if (n['@graph']) walk(n['@graph'])
    }
    walk(data)
    const recipe = nodes.find((n) => [].concat(n['@type'] ?? []).includes('Recipe'))
    if (!recipe) continue
    const ar = recipe.aggregateRating ?? {}
    const rating = Number(ar.ratingValue)
    const count = Number(ar.ratingCount ?? ar.reviewCount)
    return {
      site: siteOf(url),
      url,
      title: typeof recipe.name === 'string' ? recipe.name.trim() : undefined,
      ...(Number.isFinite(rating) && rating > 0 ? { rating: Math.round(rating * 10) / 10 } : {}),
      ...(Number.isFinite(count) && count > 0 ? { ratingCount: Math.round(count) } : {}),
    }
  }
  return null
}

/** Websuche über Brave; liefert URLs auf erlaubten Seiten. */
async function search(query, count = 8) {
  if (!process.env.BRAVE_API_KEY) throw new Error('BRAVE_API_KEY fehlt')
  const site = ALLOWED_SITES.map((s) => `site:${s}`).join(' OR ')
  const u = new URL('https://api.search.brave.com/res/v1/web/search')
  u.searchParams.set('q', `${query} (${site})`)
  u.searchParams.set('country', 'de')
  u.searchParams.set('search_lang', 'de')
  u.searchParams.set('count', String(count))
  const res = await fetch(u, { headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY } })
  if (!res.ok) throw new Error(`Brave ${res.status}`)
  const data = await res.json()
  return (data.web?.results ?? []).map((r) => r.url).filter((url) => ALLOWED_SITES.includes(siteOf(url)))
}

/** Bayes-gewichtete Bewertung, gleiche Formel wie in der App. */
const score = (m) => (m?.rating === undefined ? -1 : (m.rating * (m.ratingCount ?? 1) + 4.3 * 20) / ((m.ratingCount ?? 1) + 20))

const recipes = readdirSync(recipesDir).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(recipesDir, f), 'utf8')))
const manual = Object.assign({}, ...readdirSync(sourcesDir).filter((f) => f.endsWith('.json') && f !== 'auto.json').map((f) => JSON.parse(readFileSync(join(sourcesDir, f), 'utf8'))))
const auto = existsSync(autoFile) ? JSON.parse(readFileSync(autoFile, 'utf8')) : {}
const save = () => writeFileSync(autoFile, JSON.stringify(auto, null, 2) + '\n')

let n = 0
if (flag('--refresh')) {
  const targets = recipes.filter((r) => manual[r.id] || auto[r.id])
  for (const r of targets) {
    if (limit && n >= limit) break
    const cur = auto[r.id] ?? manual[r.id]
    try {
      const meta = await readRecipeMeta(cur.url)
      if (meta) { auto[r.id] = { ...cur, ...meta, checkedAt: new Date().toISOString().slice(0, 10) }; console.log(`↻ ${r.id}: ${meta.rating ?? '–'} (${meta.ratingCount ?? '–'})`) }
    } catch (e) { console.error(`✗ ${r.id}: ${e.message}`) }
    n++; save(); await sleep(1500)
  }
}

if (flag('--fill')) {
  const targets = recipes.filter((r) => !manual[r.id] && !auto[r.id])
  n = 0
  for (const r of targets) {
    if (limit && n >= limit) break
    n++
    try {
      const urls = await search(`${r.title} Rezept`, 6)
      let best = null
      for (const url of urls.slice(0, 4)) {
        try { const m = await readRecipeMeta(url); if (m && score(m) > score(best)) best = m } catch { /* nächste */ }
        await sleep(800)
      }
      if (best) { auto[r.id] = { ...best, checkedAt: new Date().toISOString().slice(0, 10) }; console.log(`✓ ${r.id} → ${best.site} ${best.rating ?? '–'} (${best.ratingCount ?? '–'})`) }
      else console.log(`– ${r.id}: nichts Passendes`)
    } catch (e) { console.error(`✗ ${r.id}: ${e.message}`) }
    save(); await sleep(1200)
  }
}

if (discoverN > 0) {
  // Neue, gut bewertete Gerichte finden, die es in der App noch nicht gibt → Kandidaten für den Wochen-Nachschub.
  const have = new Set(recipes.map((r) => r.title.toLowerCase()))
  const existing = existsSync(candidatesFile) ? JSON.parse(readFileSync(candidatesFile, 'utf8')) : []
  const seen = new Set(existing.map((c) => c.url))
  const queries = ['beliebteste Rezepte', 'beste Rezepte viele Bewertungen', 'vegetarische Rezepte beliebt', 'schnelle Rezepte Feierabend beliebt', 'Dessert Rezepte beliebt', 'Suppen Rezepte beliebt', 'Salat Rezepte beliebt', 'Frühstück Rezepte beliebt', 'Auflauf Rezepte beliebt', 'Pasta Rezepte beliebt', 'Curry Rezepte beliebt', 'Hähnchen Rezepte beliebt', 'Kuchen Rezepte beliebt']
  const found = []
  for (const q of queries) {
    if (found.length >= discoverN) break
    let urls = []
    try { urls = await search(q, 10) } catch (e) { console.error(`✗ Suche "${q}": ${e.message}`); continue }
    for (const url of urls) {
      if (found.length >= discoverN) break
      if (seen.has(url)) continue
      try {
        const m = await readRecipeMeta(url)
        if (m?.title && m.rating !== undefined && !have.has(m.title.toLowerCase())) { found.push({ ...m, score: score(m), foundAt: new Date().toISOString().slice(0, 10) }); seen.add(url); console.log(`★ ${m.title} – ${m.rating} (${m.ratingCount ?? '–'}) ${m.site}`) }
      } catch { /* nächste */ }
      await sleep(800)
    }
  }
  const all = [...existing, ...found].sort((a, b) => b.score - a.score)
  writeFileSync(candidatesFile, JSON.stringify(all, null, 2) + '\n')
  console.log(`${found.length} neue Kandidaten, ${all.length} gesamt.`)
}

const total = recipes.filter((r) => manual[r.id] || auto[r.id]).length
console.log(`Quellen: ${total} von ${recipes.length} Rezepten.`)
