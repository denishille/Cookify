import type { Diet, Ingredient, Recipe } from '../types'
import { DIET_RULES, TITLE_ALIASES, violates, type Sub } from './dietRules'

export { ADAPTABLE } from './dietRules'

/** Eine Anpassung an einer Zutat: ersetzen oder weglassen. */
export interface Change {
  key: string
  name: string
  action: 'ersetzen' | 'weglassen' | 'weniger'
  by?: string
  note?: string
  /** Bei 'weniger': unkritische Menge in Gramm je Portion */
  limit?: number
  diet: Diet
}

export interface Adaptation {
  /** Rezept passt, gegebenenfalls mit Änderungen */
  ok: boolean
  changes: Change[]
  /** Grund, warum es nicht geht */
  reason?: string
}

const norm = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

/** Ist das Gericht nach dieser Zutat benannt? Dann prägt sie das Rezept. */
export function inTitle(recipe: Recipe, ing: Ingredient): boolean {
  const title = norm(recipe.title)
  const words = norm(ing.name).split(/[^a-z]+/).filter((w) => w.length >= 4)
  if (words.some((w) => title.includes(w)) || title.includes(ing.key.replace(/-/g, ''))) return true
  return (TITLE_ALIASES[ing.key] ?? []).some((a) => title.includes(norm(a)))
}

/** Elementar = im Namen des Gerichts oder ein großer Teil der Menge. Solche Zutaten dürfen nicht wegfallen. */
export function isElemental(recipe: Recipe, ing: Ingredient): boolean {
  if (inTitle(recipe, ing)) return true
  const grams = (i: Ingredient) => (i.amount !== null && (i.unit === 'g' || i.unit === 'ml') ? i.amount : 0)
  const total = recipe.ingredients.reduce((a, i) => a + grams(i), 0)
  return total > 0 && grams(ing) / total >= 0.25
}

/** Prüft ein Rezept gegen eine Ernährungsform: passt, passt mit Änderungen, oder passt nicht. */
export function fitDiet(recipe: Recipe, diet: Diet): Adaptation {
  if (recipe.diet.includes(diet)) return { ok: true, changes: [] }
  const rule = DIET_RULES[diet]
  if (!rule) return { ok: false, changes: [], reason: 'nicht anpassbar' }
  const extra = rule.extra?.(recipe)
  if (extra) return { ok: false, changes: [], reason: extra }

  const changes: Change[] = []
  const seen = new Set<string>()
  let omitted = 0
  for (const ing of recipe.ingredients) {
    if (ing.optional || seen.has(ing.key) || !violates(ing, recipe.servings, rule)) continue
    seen.add(ing.key)
    const s: Sub | undefined = rule.subs[ing.key]
    if (s && !(s.minorOnly && inTitle(recipe, ing))) {
      changes.push({ key: ing.key, name: ing.name, action: 'ersetzen', by: s.by, note: s.note, diet })
      continue
    }
    // Stört die Zutat nur wegen der Menge, reicht es, davon weniger zu nehmen.
    const limit = rule.limits[ing.key]
    if (typeof limit === 'number') {
      changes.push({ key: ing.key, name: ing.name, action: 'weniger', limit, diet })
      continue
    }
    if (rule.omit.has(ing.key) && !isElemental(recipe, ing)) {
      changes.push({ key: ing.key, name: ing.name, action: 'weglassen', diet })
      omitted++
      continue
    }
    return { ok: false, changes: [], reason: `${ing.name} lässt sich nicht ersetzen` }
  }
  if (omitted > rule.maxOmit) return { ok: false, changes: [], reason: 'zu viele Zutaten müssten wegfallen' }
  if (changes.length > rule.maxChanges) return { ok: false, changes: [], reason: 'zu viel müsste geändert werden' }
  return { ok: true, changes }
}

/** Alle gewünschten Ernährungsformen zusammen; Ersatz schlägt Weglassen, je Zutat nur eine Änderung. */
export function adaptRecipe(recipe: Recipe, diets: Diet[], adapt = true): Adaptation {
  if (!adapt) {
    const missing = diets.find((d) => !recipe.diet.includes(d))
    return missing ? { ok: false, changes: [], reason: 'passt nicht ohne Änderungen' } : { ok: true, changes: [] }
  }
  const byKey = new Map<string, Change>()
  for (const d of diets) {
    const fit = fitDiet(recipe, d)
    if (!fit.ok) return fit
    for (const c of fit.changes) {
      const prev = byKey.get(c.key)
      if (!prev || (prev.action === 'weglassen' && c.action === 'ersetzen')) byKey.set(c.key, c)
    }
  }
  return { ok: true, changes: [...byKey.values()] }
}
