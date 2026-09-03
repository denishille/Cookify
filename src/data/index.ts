import type { Recipe, IngredientDef } from '../types'
import ingredientsJson from './ingredients.json'
import scheduleJson from './schedule.json'

type RawRecipe = Omit<Recipe, 'addedWeek'> & { addedWeek?: string }

/** Rezepte, die noch keiner Woche zugeordnet sind, gelten als "seit immer" verfügbar. */
const DEFAULT_WEEK = '2026-W01'

const schedule = scheduleJson as Record<string, string>

const modules = import.meta.glob<RawRecipe[]>('./recipes/*.json', { eager: true, import: 'default' })

const seen = new Set<string>()
export const ALL_RECIPES: Recipe[] = Object.keys(modules)
  .sort()
  .flatMap((path) => modules[path])
  .filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
  .map((r) => ({ ...r, addedWeek: r.addedWeek ?? schedule[r.id] ?? DEFAULT_WEEK }))

export const INGREDIENT_GROUPS: Record<string, IngredientDef[]> = ingredientsJson

export const INGREDIENTS: IngredientDef[] = Object.values(INGREDIENT_GROUPS).flat()

export const INGREDIENT_BY_KEY: Map<string, IngredientDef> = new Map(INGREDIENTS.map((i) => [i.key, i]))

export const STAPLE_KEYS: Set<string> = new Set(INGREDIENTS.filter((i) => i.staple).map((i) => i.key))

/** Die am häufigsten benötigten Zutaten (ohne Grundvorrat), für die Schnellauswahl. */
export const POPULAR_KEYS: string[] = (() => {
  const count = new Map<string, number>()
  for (const r of ALL_RECIPES) {
    const keys = new Set(r.ingredients.filter((i) => !i.optional && !STAPLE_KEYS.has(i.key)).map((i) => i.key))
    for (const k of keys) count.set(k, (count.get(k) ?? 0) + 1)
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k]) => k)
})()
