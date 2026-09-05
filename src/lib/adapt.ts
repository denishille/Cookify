import type { Diet, Ingredient, Recipe } from '../types'
import { DIET_RULES, FRUCTOSE_BUDGET, TITLE_ALIASES, fructoseGrams, portionGrams, violates, type Sub } from './dietRules'

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

/** Menge einer Zutat je Portion in Gramm, für Mengenhinweise. */
function portionGramsOf(recipe: Recipe, ing: Ingredient): number | null {
  return portionGrams(ing, recipe.servings)
}

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

/** Einstellungen, die die Bewertung beeinflussen. */
export interface DietOptions {
  /** Ersatz vorschlagen statt hart filtern */
  adapt?: boolean
}

/** Fruchtzucker eines Rezepts in Gramm je Portion. Zutaten ohne umrechenbare Menge fehlen darin. */
export function recipeFructose(recipe: Recipe, strict = false): number {
  return recipe.ingredients
    .filter((i) => !i.optional)
    .reduce((sum, i) => sum + (fructoseGrams(i, recipe.servings, strict) ?? 0), 0)
}

/**
 * Fruchtzucker rechnet nicht mit einer Verbotsliste, sondern mit Mengen: Erlaubt ist ein Budget
 * je Portion. Ersetzt wird von der stärksten Quelle abwärts, bis das Rezept darunter liegt.
 * „Fruktosefrei“ heißt immer streng: es zählt der ganze Gehalt, nicht nur der Überschuss über
 * den Traubenzucker – sonst rutschen Orangen und Ähnliches durch.
 */
function fitFructose(recipe: Recipe, strict: boolean): Adaptation {
  const rule = DIET_RULES.fruktosefrei!
  const budget = strict ? FRUCTOSE_BUDGET.streng : FRUCTOSE_BUDGET.normal
  const changes: Change[] = []
  const handled = new Set<string>()
  let omitted = 0

  // Erst die konzentrierten Zuckerquellen und Fruktane, unabhängig vom Budget.
  for (const ing of recipe.ingredients) {
    if (ing.optional || handled.has(ing.key)) continue
    const limit = rule.limits[ing.key]
    if (limit === undefined) continue
    const strictRule: typeof rule = strict
      ? { ...rule, limits: { ...rule.limits, [ing.key]: typeof limit === 'number' ? limit / 2 : limit } }
      : rule
    if (!violates(ing, recipe.servings, strictRule)) continue
    handled.add(ing.key)
    const s: Sub | undefined = rule.subs[ing.key]
    if (s && !(s.minorOnly && inTitle(recipe, ing))) {
      changes.push({ key: ing.key, name: ing.name, action: 'ersetzen', by: s.by, note: s.note, diet: 'fruktosefrei' })
      continue
    }
    if (rule.omit.has(ing.key) && !isElemental(recipe, ing)) {
      changes.push({ key: ing.key, name: ing.name, action: 'weglassen', diet: 'fruktosefrei' })
      omitted++
      continue
    }
    if (typeof limit === 'number') {
      changes.push({ key: ing.key, name: ing.name, action: 'weniger', limit: strict ? limit / 2 : limit, diet: 'fruktosefrei' })
      continue
    }
    return { ok: false, changes: [], reason: `${ing.name} lässt sich nicht ersetzen` }
  }

  const items = recipe.ingredients
    .filter((i) => !i.optional && !handled.has(i.key))
    .map((i) => ({ ing: i, f: fructoseGrams(i, recipe.servings, strict) }))
    .filter((x) => x.f === null || x.f > 0)
  // Zutaten ohne umrechenbare Menge zählen vorsichtshalber wie eine halbe Budgetportion.
  const value = (f: number | null) => (f === null ? budget / 2 : f)
  let total = items.reduce((a, x) => a + value(x.f), 0)
  if (total <= budget) {
    if (changes.length > rule.maxChanges) return { ok: false, changes: [], reason: 'zu viel müsste geändert werden' }
    return { ok: true, changes }
  }

  for (const { ing, f } of [...items].sort((a, b) => value(b.f) - value(a.f))) {
    if (total <= budget) break
    const s: Sub | undefined = rule.subs[ing.key]
    if (s && !(s.minorOnly && inTitle(recipe, ing))) {
      changes.push({ key: ing.key, name: ing.name, action: 'ersetzen', by: s.by, note: s.note, diet: 'fruktosefrei' })
      total -= value(f)
      continue
    }
    if (rule.omit.has(ing.key) && !isElemental(recipe, ing)) {
      changes.push({ key: ing.key, name: ing.name, action: 'weglassen', diet: 'fruktosefrei' })
      total -= value(f)
      omitted++
      continue
    }
    // Sonst so weit reduzieren, dass die Zutat ins verbleibende Budget passt – aber nur,
    // wenn davon noch ein sinnvoller Rest bleibt.
    if (f !== null && f > 0) {
      const rest = Math.max(0, budget - (total - f))
      const share = rest / f
      if (share >= 0.3) {
        const grams = portionGramsOf(recipe, ing)
        if (grams !== null) {
          changes.push({ key: ing.key, name: ing.name, action: 'weniger', limit: grams * share, diet: 'fruktosefrei' })
          total = budget
          continue
        }
      }
    }
    return { ok: false, changes: [], reason: `zu viel Fruchtzucker (${Math.round(total * 10) / 10} g je Portion, erlaubt sind ${budget} g)` }
  }
  if (total > budget) return { ok: false, changes: [], reason: `zu viel Fruchtzucker (${Math.round(total * 10) / 10} g je Portion, erlaubt sind ${budget} g)` }
  if (omitted > rule.maxOmit) return { ok: false, changes: [], reason: 'zu viele Zutaten müssten wegfallen' }
  if (changes.length > rule.maxChanges) return { ok: false, changes: [], reason: 'zu viel müsste geändert werden' }
  return { ok: true, changes }
}

/** Prüft ein Rezept gegen eine Ernährungsform: passt, passt mit Änderungen, oder passt nicht. */
export function fitDiet(recipe: Recipe, diet: Diet, _opts: DietOptions = {}): Adaptation {
  if (diet === 'fruktosefrei') return fitFructose(recipe, true)
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
export function adaptRecipe(recipe: Recipe, diets: Diet[], opts: DietOptions = {}): Adaptation {
  const adapt = opts.adapt ?? true
  if (!adapt) {
    const missing = diets.find((d) => !fitDiet(recipe, d, opts).ok || (d === 'fruktosefrei'
      ? fitDiet(recipe, d, opts).changes.length > 0
      : !recipe.diet.includes(d)))
    return missing ? { ok: false, changes: [], reason: 'passt nicht ohne Änderungen' } : { ok: true, changes: [] }
  }
  const byKey = new Map<string, Change>()
  for (const d of diets) {
    const fit = fitDiet(recipe, d, opts)
    if (!fit.ok) return fit
    for (const c of fit.changes) {
      const prev = byKey.get(c.key)
      if (!prev || (prev.action === 'weglassen' && c.action === 'ersetzen')) byKey.set(c.key, c)
    }
  }
  return { ok: true, changes: [...byKey.values()] }
}
