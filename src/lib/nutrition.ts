import type { Diet, Ingredient, Nutrition } from '../types'

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

/** Zutaten mit hohem FODMAP-Gehalt (Fruktane, Laktose, Fruktose, Polyole, GOS) nach der üblichen Monash-Einordnung, vereinfacht. */
const HIGH_FODMAP = new Set([
  'zwiebel', 'knoblauch', 'lauch', 'fruehlingszwiebel', 'blumenkohl', 'champignons', 'pilze', 'spargel', 'artischocken', 'rosenkohl', 'erbsen', 'fenchel',
  'apfel', 'birne', 'mango', 'kirschen', 'pflaumen', 'pfirsich', 'wassermelone', 'datteln', 'feigen', 'rosinen',
  'honig', 'agavendicksaft',
  'milch', 'sahne', 'schmand', 'creme-fraiche', 'joghurt', 'griechischer-joghurt', 'quark', 'skyr', 'huettenkaese', 'frischkaese', 'ricotta', 'mascarpone', 'buttermilch', 'sojamilch', 'eis-vanille', 'milchreis',
  'kichererbsen', 'linsen-rot', 'linsen-braun', 'belugalinsen', 'kidneybohnen', 'schwarze-bohnen', 'weisse-bohnen', 'sojahack', 'seitan',
  'mehl', 'vollkornmehl', 'spaghetti', 'penne', 'nudeln', 'lasagneplatten', 'gnocchi', 'couscous', 'bulgur', 'brot', 'toast', 'baguette', 'broetchen', 'tortillas', 'pizzateig', 'blaetterteig', 'mehlbutter-fertigteig', 'pita', 'naan', 'semmelbroesel', 'udon', 'ramen-nudeln', 'loeffelbiskuits', 'butterkekse', 'bier',
  'pistazien', 'cashews',
])

/** Fruktosereiche Zutaten und Fruktane, die bei Fruktoseintoleranz typischerweise Probleme machen. */
const HIGH_FRUCTOSE = new Set([
  'apfel', 'birne', 'mango', 'wassermelone', 'kirschen', 'trauben', 'feigen', 'datteln', 'rosinen', 'granatapfel', 'pflaumen', 'pfirsich', 'ananas', 'kiwi',
  'honig', 'agavendicksaft', 'marmelade', 'orangensaft', 'apfelmus', 'ketchup', 'bbq-sauce', 'tomatenmark',
  'zwiebel', 'knoblauch', 'lauch', 'artischocken', 'spargel',
])

const requiredKeys = (ingredients: Ingredient[]) => ingredients.filter((i) => !i.optional).map((i) => i.key)

export function isLowFodmap(ingredients: Ingredient[]): boolean {
  return !requiredKeys(ingredients).some((k) => HIGH_FODMAP.has(k))
}

export function isFructoseFree(ingredients: Ingredient[]): boolean {
  return !requiredKeys(ingredients).some((k) => HIGH_FRUCTOSE.has(k))
}

/** Ersetzt die rechnerischen Flags durch die aus Nährwerten und Zutaten abgeleiteten. */
export function derivedDiet(diet: Diet[], n: Nutrition, ingredients: Ingredient[] = []): Diet[] {
  const computed: Diet[] = ['proteinreich', 'lowcarb', 'kalorienarm', 'lowfodmap', 'fruktosefrei']
  const keep: Diet[] = diet.filter((d) => !computed.includes(d))
  if (isHighProtein(n)) keep.push('proteinreich')
  if (isLowCarb(n)) keep.push('lowcarb')
  if (isLowCalorie(n)) keep.push('kalorienarm')
  if (isLowFodmap(ingredients)) keep.push('lowfodmap')
  if (isFructoseFree(ingredients)) keep.push('fruktosefrei')
  return keep
}
