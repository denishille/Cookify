import type { Diet } from '../types'
import { INGREDIENT_GROUPS } from '../data'

/** Zutaten, die zur Ernährungsform grundsätzlich nicht passen (nur harte Ausschlüsse; Gluten/Laktose usw. werden ersetzt). */
const VEGETARIAN_EXTRA = ['huehnerbruehe', 'fischsauce', 'gelatine', 'worcestersauce']
const VEGAN_EXTRA = ['honig', 'eis-vanille', 'mayonnaise', 'loeffelbiskuits', 'butterkekse', 'mehlbutter-fertigteig']

function groupKeys(...groups: string[]): string[] {
  return groups.flatMap((g) => (INGREDIENT_GROUPS[g] ?? []).map((i) => i.key))
}

/** Zutaten-Keys, die bei den angegebenen Ernährungsformen ausgeblendet werden. */
export function excludedIngredientKeys(diets: readonly Diet[]): Set<string> {
  const out = new Set<string>()
  if (diets.includes('vegetarisch') || diets.includes('vegan')) {
    for (const k of [...groupKeys('fleisch', 'fisch'), ...VEGETARIAN_EXTRA]) out.add(k)
  }
  if (diets.includes('vegan')) {
    for (const k of [...groupKeys('milchprodukte'), ...VEGAN_EXTRA]) out.add(k)
  }
  return out
}

/** Beispieltext für die Zutatensuche, passend zur Ernährungsform. */
export function ingredientPlaceholder(diets: readonly Diet[]): string {
  if (diets.includes('vegan')) return 'z. B. Tofu, Reis, Kichererbsen …'
  if (diets.includes('vegetarisch')) return 'z. B. Tomaten, Reis, Feta …'
  return 'z. B. Hähnchen, Reis, Feta …'
}
