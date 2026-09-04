import type { Diet, Ingredient, Recipe } from '../types'
import { HARD_TO_DIGEST, HIGH_FODMAP, HIGH_FRUCTOSE } from './nutrition'

/** Eine Anpassung an einer Zutat: ersetzen oder weglassen. */
export interface Change {
  key: string
  name: string
  action: 'ersetzen' | 'weglassen'
  by?: string
  diet: Diet
}

export interface Adaptation {
  /** Rezept passt (ggf. mit Änderungen) */
  ok: boolean
  changes: Change[]
  /** Grund, warum es nicht geht */
  reason?: string
}

/** Ernährungsformen, bei denen Ersatz oder Weglassen möglich ist. Alle anderen sind hart. */
export const ADAPTABLE: Diet[] = ['glutenfrei', 'laktosefrei', 'lowfodmap', 'fruktosefrei', 'leichtverdaulich']

const GLUTEN_SUBS: Record<string, string> = {
  spaghetti: 'glutenfreie Spaghetti', penne: 'glutenfreie Penne', nudeln: 'glutenfreie Nudeln', lasagneplatten: 'glutenfreie Lasagneplatten',
  gnocchi: 'glutenfreie Gnocchi', udon: 'Reisnudeln', 'ramen-nudeln': 'Reisnudeln', mehl: 'glutenfreie Mehlmischung', vollkornmehl: 'glutenfreie Mehlmischung',
  semmelbroesel: 'glutenfreie Semmelbrösel', brot: 'glutenfreies Brot', toast: 'glutenfreies Toastbrot', baguette: 'glutenfreies Baguette', broetchen: 'glutenfreie Brötchen',
  tortillas: 'Maistortillas', pizzateig: 'glutenfreier Pizzateig', blaetterteig: 'glutenfreier Blätterteig', 'mehlbutter-fertigteig': 'glutenfreier Mürbeteig',
  pita: 'glutenfreies Fladenbrot', naan: 'glutenfreies Fladenbrot', couscous: 'Quinoa', bulgur: 'Quinoa', haferflocken: 'glutenfreie Haferflocken',
  sojasauce: 'Tamari (glutenfreie Sojasauce)', bier: 'glutenfreies Bier', seitan: 'Tofu', loeffelbiskuits: 'glutenfreie Löffelbiskuits', butterkekse: 'glutenfreie Kekse',
  knaeckebrot: 'glutenfreies Knäckebrot', granola: 'glutenfreies Granola', 'worcestersauce': 'glutenfreie Worcestersauce',
}

const LACTOSE_SUBS: Record<string, string> = {
  milch: 'laktosefreie Milch oder Hafermilch', sahne: 'Hafercreme (Hafer-Cuisine)', schmand: 'laktosefreier Schmand', 'creme-fraiche': 'laktosefreie Crème fraîche',
  joghurt: 'laktosefreier Joghurt', 'griechischer-joghurt': 'laktosefreier griechischer Joghurt', quark: 'laktosefreier Quark', skyr: 'laktosefreier Skyr',
  huettenkaese: 'laktosefreier Hüttenkäse', frischkaese: 'laktosefreier Frischkäse', butter: 'laktosefreie Butter', mozzarella: 'laktosefreier Mozzarella',
  gouda: 'laktosefreier Gouda', emmentaler: 'laktosefreier Emmentaler', cheddar: 'laktosefreier Cheddar', 'kaese-gerieben': 'laktosefreier Reibekäse',
  ricotta: 'laktosefreier Ricotta', mascarpone: 'laktosefreier Mascarpone', buttermilch: 'laktosefreie Buttermilch', 'eis-vanille': 'laktosefreies Vanilleeis',
  halloumi: 'laktosefreier Halloumi', feta: 'laktosefreier Feta', ziegenkaese: 'laktosefreier Ziegenkäse', blauschimmelkaese: 'laktosefreier Käse',
}

const FODMAP_SUBS: Record<string, string> = {
  ...GLUTEN_SUBS, ...LACTOSE_SUBS,
  zwiebel: 'Lauchgrün (nur der grüne Teil)', knoblauch: 'Knoblauchöl', lauch: 'Lauchgrün (nur der grüne Teil)', fruehlingszwiebel: 'Frühlingszwiebelgrün',
  honig: 'Ahornsirup', agavendicksaft: 'Ahornsirup', blumenkohl: 'Brokkoliröschen', champignons: 'Austernpilze', pilze: 'Austernpilze',
  cashews: 'Macadamia oder Erdnüsse', pistazien: 'Walnüsse', sojamilch: 'Hafermilch', apfel: 'Orange', birne: 'Orange', mango: 'Ananas',
  kichererbsen: 'Kichererbsen aus der Dose, gut abgespült (kleine Portion)', 'linsen-rot': 'Dosenlinsen, gut abgespült (kleine Portion)', 'linsen-braun': 'Dosenlinsen, gut abgespült (kleine Portion)',
  erbsen: 'grüne Bohnen', fenchel: 'Zucchini', spargel: 'grüne Bohnen',
}
/** Bei Low FODMAP zusätzlich verzichtbar, falls nicht elementar. */
const FODMAP_OMIT = new Set(['rosenkohl', 'artischocken', 'kirschen', 'pflaumen', 'pfirsich', 'wassermelone', 'datteln', 'feigen', 'rosinen', 'belugalinsen', 'kidneybohnen', 'schwarze-bohnen', 'weisse-bohnen', 'sojahack', 'milchreis'])

const FRUCTOSE_SUBS: Record<string, string> = {
  honig: 'Reissirup', agavendicksaft: 'Reissirup', zwiebel: 'Lauchgrün (nur der grüne Teil)', knoblauch: 'Knoblauchöl', lauch: 'Lauchgrün (nur der grüne Teil)',
  apfel: 'Banane', birne: 'Banane', mango: 'Papaya', tomatenmark: 'etwas mehr Passata, länger eingekocht', marmelade: 'fruktosearme Marmelade',
}
const FRUCTOSE_OMIT = new Set(['wassermelone', 'kirschen', 'trauben', 'feigen', 'datteln', 'rosinen', 'granatapfel', 'pflaumen', 'pfirsich', 'ananas', 'kiwi', 'orangensaft', 'apfelmus', 'ketchup', 'bbq-sauce', 'artischocken', 'spargel'])

const DIGEST_SUBS: Record<string, string> = {
  weisswein: 'Gemüsebrühe', rotwein: 'Gemüsebrühe', bier: 'Gemüsebrühe', weisskohl: 'Zucchini', rotkohl: 'Karotten', rosenkohl: 'Zucchini', gruenkohl: 'Spinat',
  blumenkohl: 'Zucchini', sauerkraut: 'gedünstete Karotten', currypaste: 'mildes Currypulver',
}
const DIGEST_OMIT = new Set(['chili', 'chiliflocken', 'sriracha', 'sambal-oelek', 'harissa', 'kaffee', 'kichererbsen', 'linsen-rot', 'linsen-braun', 'belugalinsen', 'kidneybohnen', 'schwarze-bohnen', 'weisse-bohnen', 'edamame', 'sojahack'])

interface Rule { offending: Set<string>; subs: Record<string, string>; omit: Set<string>; extra?: (r: Recipe) => string | null }

export const GLUTEN = new Set(Object.keys(GLUTEN_SUBS))
export const LACTOSE = new Set(Object.keys(LACTOSE_SUBS))

const RULES: Partial<Record<Diet, Rule>> = {
  glutenfrei: { offending: GLUTEN, subs: GLUTEN_SUBS, omit: new Set() },
  laktosefrei: { offending: LACTOSE, subs: LACTOSE_SUBS, omit: new Set() },
  lowfodmap: { offending: HIGH_FODMAP, subs: FODMAP_SUBS, omit: FODMAP_OMIT },
  fruktosefrei: { offending: HIGH_FRUCTOSE, subs: FRUCTOSE_SUBS, omit: FRUCTOSE_OMIT },
  leichtverdaulich: { offending: HARD_TO_DIGEST, subs: DIGEST_SUBS, omit: DIGEST_OMIT, extra: (r) => (r.nutrition.fat > 25 ? 'zu fettreich' : null) },
}

const norm = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

/** Elementar = steht im Titel oder macht einen großen Teil der Menge aus. Solche Zutaten dürfen nicht einfach wegfallen. */
export function isElemental(recipe: Recipe, ing: Ingredient): boolean {
  const title = norm(recipe.title)
  const words = norm(ing.name).split(/[^a-z]+/).filter((w) => w.length >= 4)
  if (words.some((w) => title.includes(w)) || title.includes(ing.key.replace(/-/g, ''))) return true
  const grams = (i: Ingredient) => (i.amount !== null && (i.unit === 'g' || i.unit === 'ml') ? i.amount : 0)
  const total = recipe.ingredients.reduce((a, i) => a + grams(i), 0)
  return total > 0 && grams(ing) / total >= 0.25
}

/** Prüft ein Rezept gegen eine Ernährungsform: passt, passt mit Änderungen, oder passt nicht. */
export function fitDiet(recipe: Recipe, diet: Diet): Adaptation {
  if (recipe.diet.includes(diet)) return { ok: true, changes: [] }
  const rule = RULES[diet]
  if (!rule) return { ok: false, changes: [], reason: 'nicht anpassbar' }
  const extra = rule.extra?.(recipe)
  if (extra) return { ok: false, changes: [], reason: extra }
  const changes: Change[] = []
  const seen = new Set<string>()
  let omitted = 0
  for (const ing of recipe.ingredients) {
    if (ing.optional || !rule.offending.has(ing.key) || seen.has(ing.key)) continue
    seen.add(ing.key)
    const by = rule.subs[ing.key]
    if (by) { changes.push({ key: ing.key, name: ing.name, action: 'ersetzen', by, diet }); continue }
    if (rule.omit.has(ing.key) && !isElemental(recipe, ing)) { changes.push({ key: ing.key, name: ing.name, action: 'weglassen', diet }); omitted++; continue }
    return { ok: false, changes: [], reason: `${ing.name} ist unverzichtbar` }
  }
  if (omitted > 2) return { ok: false, changes: [], reason: 'zu viele Zutaten müssten wegfallen' }
  return { ok: true, changes }
}

/** Alle gewünschten Ernährungsformen zusammen; Ersatz schlägt Weglassen, pro Zutat nur eine Änderung. */
export function adaptRecipe(recipe: Recipe, diets: Diet[]): Adaptation {
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
