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
