import type { Diet, Nutrition } from '../types'

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

/** Ersetzt die rechnerischen Flags (proteinreich, lowcarb, kalorienarm) durch die aus den Nährwerten abgeleiteten. */
export function derivedDiet(diet: Diet[], n: Nutrition): Diet[] {
  const keep: Diet[] = diet.filter((d) => d !== 'proteinreich' && d !== 'lowcarb' && d !== 'kalorienarm')
  if (isHighProtein(n)) keep.push('proteinreich')
  if (isLowCarb(n)) keep.push('lowcarb')
  if (isLowCalorie(n)) keep.push('kalorienarm')
  return keep
}
