import type { Recipe, Ingredient } from '../types'
import { STAPLE_KEYS } from '../data'

export interface MatchResult {
  recipe: Recipe
  /** Pflichtzutaten (ohne Grundvorrat, ohne optionale) */
  required: Ingredient[]
  have: Ingredient[]
  missing: Ingredient[]
  /** 0..1, Anteil der vorhandenen Pflichtzutaten */
  score: number
}

/** Zutaten, die man wirklich braucht: keine Grundvorräte wie Salz/Öl, keine optionalen. */
export function requiredIngredients(recipe: Recipe): Ingredient[] {
  const byKey = new Map<string, Ingredient>()
  for (const ing of recipe.ingredients) {
    if (ing.optional || STAPLE_KEYS.has(ing.key)) continue
    if (!byKey.has(ing.key)) byKey.set(ing.key, ing)
  }
  return [...byKey.values()]
}

export function matchRecipe(recipe: Recipe, pantry: Set<string>): MatchResult {
  const required = requiredIngredients(recipe)
  const have = required.filter((i) => pantry.has(i.key))
  const missing = required.filter((i) => !pantry.has(i.key))
  const score = required.length === 0 ? 1 : have.length / required.length
  return { recipe, required, have, missing, score }
}

/**
 * Sortiert Rezepte nach Passgenauigkeit zum Vorrat.
 * Rezepte ohne einen einzigen Treffer werden ausgelassen, damit die Liste nicht mit Zufall gefüllt ist.
 */
export function rankByPantry(recipes: Recipe[], pantry: Set<string>, maxMissing: number): MatchResult[] {
  if (pantry.size === 0) return []
  return recipes
    .map((r) => matchRecipe(r, pantry))
    .filter((m) => m.have.length > 0 && m.missing.length <= maxMissing)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length
      if (b.have.length !== a.have.length) return b.have.length - a.have.length
      return a.recipe.timeMinutes - b.recipe.timeMinutes
    })
}

/**
 * Wie streng darf gefiltert werden? Je voller der Vorrat, desto eher findet sich ein Rezept,
 * das wirklich passt – also darf weniger fehlen. Bei zwei, drei Zutaten wäre das Ergebnis leer,
 * dort zeigen wir lieber ein breites Angebot.
 */
export function toleranceFor(pantrySize: number): number {
  if (pantrySize <= 2) return ALL_MATCHES
  if (pantrySize <= 4) return 6
  if (pantrySize <= 8) return 4
  if (pantrySize <= 12) return 3
  if (pantrySize <= 18) return 2
  return 1
}

/** Keine Obergrenze: zeigt alles, was mindestens eine der Zutaten verwendet. */
export const ALL_MATCHES = 99

/** Unter so vielen Treffern lohnt die Liste nicht, dann wird die Regel gelockert. */
const MIN_RESULTS = 12

export interface AutoMatch {
  results: MatchResult[]
  /** Wie viele Zutaten am Ende fehlen durften – für den Hinweis über der Liste. */
  tolerance: number
}

/**
 * Sucht selbst die passende Strenge: erst exakte Treffer, dann Schritt für Schritt großzügiger,
 * bis genug zusammenkommt – höchstens aber so großzügig, wie es die Vorratsgröße zulässt.
 */
export function autoMatch(recipes: Recipe[], pantry: Set<string>): AutoMatch {
  if (pantry.size === 0) return { results: [], tolerance: 0 }
  const effective = [...pantry].filter((k) => !STAPLE_KEYS.has(k)).length
  const max = toleranceFor(effective)
  // Bei ein, zwei Zutaten gibt es nichts zu filtern: zeig alles, was sie verwendet.
  if (max === ALL_MATCHES) return { results: rankByPantry(recipes, pantry, ALL_MATCHES), tolerance: ALL_MATCHES }
  let last: MatchResult[] = []
  for (let tolerance = 0; tolerance <= max; tolerance++) {
    last = rankByPantry(recipes, pantry, tolerance)
    if (last.length >= MIN_RESULTS) return { results: last, tolerance }
  }
  return { results: last, tolerance: max }
}
