import type { Diet, Ingredient, Nutrition } from '../types'
import { offendingIngredients } from './dietRules'

/** Anteil der Energie aus Protein (4 kcal je Gramm), 0..1. */
export function proteinShare(n: Nutrition): number {
  return n.kcal > 0 ? (n.protein * 4) / n.kcal : 0
}

/** Anteil der Energie aus Kohlenhydraten (4 kcal je Gramm), 0..1. */
export function carbShare(n: Nutrition): number {
  return n.kcal > 0 ? (n.carbs * 4) / n.kcal : 0
}

/**
 * Proteinreich: mindestens 20 % der Energie aus Protein (EU-Grenzwert für „hoher Proteingehalt“),
 * oder mindestens 25 g Protein pro Portion bei mindestens 15 % Anteil.
 */
export function isHighProtein(n: Nutrition): boolean {
  const s = proteinShare(n)
  return s >= 0.2 || (n.protein >= 25 && s >= 0.15)
}

/** Low Carb: höchstens 20 g Kohlenhydrate pro Portion oder höchstens 20 % der Energie aus Kohlenhydraten. */
export function isLowCarb(n: Nutrition): boolean {
  return n.carbs <= 20 || carbShare(n) <= 0.2
}

/** Kalorienarm: unter 400 kcal pro Portion. */
export function isLowCalorie(n: Nutrition): boolean {
  return n.kcal < 400
}

/** Zutaten, die bei dieser Ernährungsform stören – auf Basis des gemeinsamen Regelwerks. */
function hasOffending(ingredients: Ingredient[], servings: number, diet: Diet): boolean {
  return offendingIngredients(ingredients, servings, diet).length > 0
}

/** Leicht verdaulich (Schonkost): nichts Schwerverdauliches oder Scharfes, kein Alkohol, höchstens 25 g Fett. */
export function isEasyToDigest(ingredients: Ingredient[], n: Nutrition, servings = 4): boolean {
  return n.fat <= 25 && !hasOffending(ingredients, servings, 'leichtverdaulich')
}

export function isFructoseFree(ingredients: Ingredient[], servings = 4): boolean {
  return !hasOffending(ingredients, servings, 'fruktosefrei')
}

export function isGlutenFree(ingredients: Ingredient[], servings = 4): boolean {
  return !hasOffending(ingredients, servings, 'glutenfrei')
}

export function isLactoseFree(ingredients: Ingredient[], servings = 4): boolean {
  return !hasOffending(ingredients, servings, 'laktosefrei')
}

/** Ersetzt die rechnerischen Flags durch die aus Nährwerten und Zutaten abgeleiteten. */
export function derivedDiet(diet: Diet[], n: Nutrition, ingredients: Ingredient[] = [], servings = 4): Diet[] {
  const computed: Diet[] = ['proteinreich', 'lowcarb', 'kalorienarm', 'fruktosefrei', 'leichtverdaulich', 'glutenfrei', 'laktosefrei']
  const keep: Diet[] = diet.filter((d) => !computed.includes(d))
  if (isGlutenFree(ingredients, servings)) keep.push('glutenfrei')
  if (isLactoseFree(ingredients, servings)) keep.push('laktosefrei')
  if (isHighProtein(n)) keep.push('proteinreich')
  if (isLowCarb(n)) keep.push('lowcarb')
  if (isLowCalorie(n)) keep.push('kalorienarm')
  if (isFructoseFree(ingredients, servings)) keep.push('fruktosefrei')
  if (isEasyToDigest(ingredients, n, servings)) keep.push('leichtverdaulich')
  return keep
}
